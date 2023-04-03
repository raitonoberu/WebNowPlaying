import { getRandomToken } from '../../utils/misc'
import { defaultSettings } from '../../utils/settings'
import { ServiceWorkerUtils } from '../../utils/sw'
import { MediaInfo, NetflixInfo, Site, SiteInfo, StateMode, YouTubeInfo } from '../types'
import Applemusic from './sites/AppleMusic'
import Bandcamp from './sites/Bandcamp'
import Deezer from './sites/Deezer'
import Generic from './sites/Generic'
import Invidious from './sites/Invidious'
import Jellyfin from './sites/Jellyfin'
import Navidrome from './sites/Navidrome'
import Netflix from './sites/Netflix'
import Pandora from './sites/Pandora'
import Plex from './sites/Plex'
import RadioAddict from './sites/RadioAddict'
import Soundcloud from './sites/Soundcloud'
import Spotify from './sites/Spotify'
import Tidal from './sites/Tidal'
import Twitch from './sites/Twitch'
import YouTube from './sites/YouTube'
import YouTubeEmbed from './sites/YouTubeEmbed'
import YouTubeMusic from './sites/YouTubeMusic'

// This is for use in any file that ends up compiled into content.js
// as instead of constantly requesting the settings from the service
// worker, we just store it in a variable
let _settings = defaultSettings
export const ContentUtils = {
  getSettings: () => _settings,
  init: async () => {
    _settings = await ServiceWorkerUtils.getSettings()

    const site = getCurrentSite()
    if (site !== null) {
      if (document.querySelector('#wnp-injected') === null) {
        const script = document.createElement('script')
        script.id = 'wnp-injected'
        script.src = chrome.runtime.getURL('injected.js')
        document.documentElement.appendChild(script)
      }
    }
  },
  sendMessage: <T>({ event, data }: { event: string, data?: any }): Promise<T> => new Promise((resolve) => {
    const id = getRandomToken()
    const listener = (e: any) => {
      if (e.data.type === 'wnp-response' && e.data.id === id) {
        resolve(e.data.value)
        window.removeEventListener('message', listener)
      }
    }
    window.addEventListener('message', listener)
    window.postMessage({ id, type: 'wnp-message', event, data }, '*')
  }),
  getYouTubeInfo: () => ContentUtils.sendMessage<YouTubeInfo>({ event: 'getYouTubeInfo' }),
  setYouTubeVolume: (volume: number) => ContentUtils.sendMessage({ event: 'setYouTubeVolume', data: volume }),
  getYouTubeMusicVolume: () => ContentUtils.sendMessage<number>({ event: 'getYouTubeMusicVolume' }),
  setYouTubeMusicVolume: (volume: number) => ContentUtils.sendMessage({ event: 'setYouTubeMusicVolume', data: volume }),
  seekNetflix: (time: number) => ContentUtils.sendMessage({ event: 'seekNetflix', data: time }),
  getNetflixInfo: () => ContentUtils.sendMessage<NetflixInfo>({ event: 'getNetflixInfo' })
}

function _getCurrentSite() {
  const host = window.location.hostname
  const settings = ContentUtils.getSettings()


  if (host === 'music.apple.com' && !settings.disabledSites.includes('Apple Music'))
    return Applemusic
  else if ((host.endsWith('bandcamp.com') || document.querySelector('[content="@bandcamp"]') !== null) && !settings.disabledSites.includes('Bandcamp'))
    return Bandcamp
  else if (host === 'www.deezer.com' && !settings.disabledSites.includes('Deezer'))
    return Deezer
  else if (document.querySelector('link[title="Invidious"]') && !settings.disabledSites.includes('Invidious'))
    return Invidious
  else if (document.querySelector('[content="Jellyfin"]') !== null && !settings.disabledSites.includes('Jellyfin'))
    return Jellyfin
  else if (document.querySelector('[content="Navidrome"]') !== null && !settings.disabledSites.includes('Navidrome'))
    return Navidrome
  else if (host === 'www.netflix.com' && !settings.disabledSites.includes('Netflix'))
    return Netflix
  else if (host === 'www.pandora.com' && !settings.disabledSites.includes('Pandora'))
    return Pandora
  else if (host === 'app.plex.tv' && !settings.disabledSites.includes('Plex'))
    return Plex
  else if (host === 'www.radio-addict.com' && !settings.disabledSites.includes('Radio Addict'))
    return RadioAddict
  else if (host === 'soundcloud.com' && !settings.disabledSites.includes('Soundcloud'))
    return Soundcloud
  else if (host === 'open.spotify.com' && !settings.disabledSites.includes('Spotify'))
    return Spotify
  else if (host === 'listen.tidal.com' && !settings.disabledSites.includes('Tidal'))
    return Tidal
  else if (host === 'www.twitch.tv' && !settings.disabledSites.includes('Twitch'))
    return Twitch
  // prioritize matching youtube.com/embed before youtube.com
  if (host === 'www.youtube.com' && window.location.pathname.startsWith('/embed') && !settings.disabledSites.includes('YouTube Embeds'))
    return YouTubeEmbed
  else if (host === 'www.youtube.com' && !settings.disabledSites.includes('YouTube'))
    return YouTube
  else if (host === 'music.youtube.com' && !settings.disabledSites.includes('YouTube Music'))
    return YouTubeMusic

  if (settings.useGeneric) {
    if (settings.useGenericList) {
      if (settings.isListBlocked && settings.genericList.includes(host)) return null
      if (!settings.isListBlocked && !settings.genericList.includes(host)) return null
    }
    return Generic
  }

  return null
}

export const getCurrentSite = () => {
  const site = _getCurrentSite()
  if (site && !site.isInitialized) {
    site.isInitialized = true
    site.init?.()
  }
  return site
}

const mediaInfoCache = new Map<string, any>()
let sendFullMediaInfo = false
export const setSendFullMediaInfo = (value: boolean) => sendFullMediaInfo = value
export const getMediaInfo = (): Partial<MediaInfo> | null => {
  const site = getCurrentSite()
  const mediaInfo: Partial<MediaInfo> = {}
  let mediaInfoChanged = false

  if (!site || !site.ready()) return null

  const values: (keyof SiteInfo)[] = ['player', 'state', 'title', 'artist', 'album', 'cover', 'duration', 'position', 'volume', 'rating', 'repeat', 'shuffle']
  for (const key of values) {
    let value = site.info[key]?.()
    // For numbers, round it to an integer
    if (typeof value === 'number')
      value = Math.round(value)
    // Trim strings
    else if (typeof value === 'string')
      value = value.trim()
    if (value !== null && value !== undefined && mediaInfoCache.get(key) !== value) {
      if (key === 'state' || key === 'title' || (key === 'volume' && (mediaInfoCache.get('state') || StateMode.STOPPED) === StateMode.PLAYING)) {
        const timestamp = value.toString().length > 0 ? Date.now() : 0
        mediaInfo.timestamp = timestamp
        mediaInfoCache.set('timestamp', timestamp)
      }
      (mediaInfo[key] as any) = value
      mediaInfoCache.set(key, value)
      mediaInfoChanged = true
    }
  }

  if (sendFullMediaInfo) {
    sendFullMediaInfo = false
    return Object.fromEntries(mediaInfoCache)
  }

  if (mediaInfoChanged) return mediaInfo
  else return null
}

export const ratingUtils = {
  like: (site: Site, rating: number) => {
    if (rating >= 3 && site.info.rating?.() !== 5)
      site.events.toggleThumbsUp?.()
    else if (rating < 3 && site.info.rating?.() === 5)
      site.events.toggleThumbsUp?.()
  },
  likeDislike: (site: Site, rating: number) => {
    if (rating >= 3 && site.info.rating?.() !== 5)
      site.events.toggleThumbsUp?.()
    else if (rating < 3 && site.info.rating?.() !== 1)
      site.events.toggleThumbsDown?.()
  }
}