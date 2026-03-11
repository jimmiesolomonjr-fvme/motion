import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = 'G-9M4H5M6XKC';

export function initGA() {
  ReactGA.initialize(GA_MEASUREMENT_ID);
}

export function trackPageView(path) {
  ReactGA.send({ hitType: 'pageview', page: path });
}
