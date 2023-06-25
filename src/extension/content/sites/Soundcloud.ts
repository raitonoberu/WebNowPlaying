import { convertTimeToSeconds, getMediaSessionCover } from "../../../utils/misc";
import { RatingSystem, RepeatMode, Site, StateMode } from "../../types";
import { querySelector, querySelectorEvent, querySelectorEventReport, querySelectorReport } from "../selectors";
import { ratingUtils } from "../utils";

const site: Site = {
  match: () => window.location.hostname === "soundcloud.com",
  ready: () => navigator.mediaSession.metadata !== null,
  ratingSystem: RatingSystem.LIKE,
  info: {
    playerName: () => "Soundcloud",
    state: () => (navigator.mediaSession.playbackState === "playing" ? StateMode.PLAYING : StateMode.PAUSED),
    title: () => navigator.mediaSession.metadata?.title || "",
    artist: () => navigator.mediaSession.metadata?.artist || "",
    album: () => navigator.mediaSession.metadata?.album || "",
    coverUrl: () => getMediaSessionCover(),
    durationSeconds: () =>
      querySelectorReport<number, HTMLElement>(
        "(.playbackTimeline__duration > span)[1]",
        (el) => convertTimeToSeconds(el.innerText),
        0,
        "durationSeconds"
      ),
    positionSeconds: () =>
      querySelectorReport<number, HTMLElement>(
        "(.playbackTimeline__timePassed > span)[1]",
        (el) => convertTimeToSeconds(el.innerText),
        0,
        "positionSeconds"
      ),
    volume: () => {
      const p = querySelectorReport<number, HTMLElement>(".volume__sliderProgress", (el) => el.getBoundingClientRect().height, 1, "volume");
      const h = querySelectorReport<number, HTMLElement>(".volume__sliderBackground", (el) => el.getBoundingClientRect().height, 1, "volume");
      return (p / h) * 100;
    },
    rating: () =>
      querySelectorReport<number, HTMLElement>(".playbackSoundBadge__like", (el) => (el.className.includes("selected") ? 5 : 0), 0, "rating"),
    repeatMode: () => {
      if (querySelector<boolean, HTMLElement>(".m-one", (el) => el !== null, false)) return RepeatMode.ONE;
      if (querySelector<boolean, HTMLElement>(".m-all", (el) => el !== null, false)) return RepeatMode.ALL;
      return RepeatMode.NONE;
    },
    // Not reporting this as .m-shuffling is only present when shuffle is enabled
    shuffleActive: () => querySelector<boolean, HTMLElement>(".m-shuffling", () => true, false),
  },
  canSkipPrevious: () => querySelector<boolean, HTMLButtonElement>(".skipControl__previous", (el) => !el.disabled, false),
  canSkipNext: () => querySelector<boolean, HTMLButtonElement>(".skipControl__next", (el) => !el.disabled, false),
  events: {
    setState: (state) => {
      if (site.info.state() === state) return;
      querySelectorEventReport<HTMLButtonElement>(".playControl", (el) => el.click(), "setState");
    },
    skipPrevious: () => querySelectorEventReport<HTMLButtonElement>(".skipControl__previous", (el) => el.click(), "skipPrevious"),
    skipNext: () => querySelectorEventReport<HTMLButtonElement>(".skipControl__next", (el) => el.click(), "skipNext"),
    setPositionSeconds: null,
    setPositionPercentage: (positionPercentage: number) => {
      querySelectorEventReport<HTMLElement>(
        ".playbackTimeline__progressWrapper",
        (el) => {
          const loc = el.getBoundingClientRect();
          const position = positionPercentage * loc.width;

          el.dispatchEvent(
            new MouseEvent("mousedown", {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: loc.left + position,
              clientY: loc.top + loc.height / 2,
            })
          );
          el.dispatchEvent(
            new MouseEvent("mouseup", {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: loc.left + position,
              clientY: loc.top + loc.height / 2,
            })
          );
        },
        "setPositionPercentage"
      );
    },
    setVolume: (volume: number) => {
      querySelectorEvent<HTMLElement>(".volume", (el) => {
        el.dispatchEvent(
          new MouseEvent("mouseover", {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: 0,
            clientY: 0,
          })
        );
        el.dispatchEvent(
          new MouseEvent("mousemove", {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: 0,
            clientY: 0,
          })
        );

        let counter = 0;
        let vol = volume / 100;
        const volumeReadyTest = setInterval(() => {
          if (querySelector<boolean, HTMLElement>(".volume.expanded.hover", (el) => true, false)) {
            clearInterval(volumeReadyTest);
            querySelectorEvent<HTMLElement>(".volume__sliderBackground", (el) => {
              const loc = el.getBoundingClientRect();
              vol *= loc.height;

              el.dispatchEvent(
                new MouseEvent("mousedown", {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: loc.left + loc.width / 2,
                  clientY: loc.bottom - vol + 5,
                })
              );
              el.dispatchEvent(
                new MouseEvent("mouseup", {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: loc.left + loc.width / 2,
                  clientY: loc.bottom - vol + 5,
                })
              );

              querySelectorEventReport<HTMLElement>(
                ".volume",
                (el2) => {
                  el2.dispatchEvent(
                    new MouseEvent("mouseout", {
                      view: window,
                      bubbles: true,
                      cancelable: true,
                      clientX: 0,
                      clientY: 0,
                    })
                  );
                },
                "setVolume"
              );
            });
          } else {
            counter += 1;
            if (counter > 10) clearInterval(volumeReadyTest);
          }
        }, 25);
      });
    },
    toggleRepeatMode: () => querySelectorEventReport<HTMLButtonElement>(".repeatControl", (el) => el.click(), "toggleRepeatMode"),
    toggleShuffleActive: () => querySelectorEventReport<HTMLButtonElement>(".shuffleControl", (el) => el.click(), "toggleShuffleActive"),
    setRating: (rating: number) => {
      ratingUtils.like(rating, site, {
        toggleLike: () => {
          querySelectorEventReport<HTMLButtonElement>(".playbackSoundBadge__like", (el) => el.click(), "setRating");
        },
      });
    },
  },
};

export default site;
