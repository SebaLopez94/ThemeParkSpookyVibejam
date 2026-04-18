/** Returns true when running on a mobile/tablet — checked by UA and viewport width. */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}
