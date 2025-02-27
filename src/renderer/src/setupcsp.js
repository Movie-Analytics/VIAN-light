export const setupCsp = () => {
  // eslint-disable-next-line
  if (isElectron) {
    // Only add CSP meta tag in Electron
    const meta = document.createElement('meta')
    meta.httpEquiv = 'Content-Security-Policy'
    meta.content =
      "default-src 'self' app: *; media-src file: app: *; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    document.head.appendChild(meta)
  }
}
