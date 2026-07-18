# assetlinks.json — Android App Links verification

TODO: Replace `PLACEHOLDER_SHA256` in `assetlinks.json` with your actual
SHA-256 certificate fingerprint. Get it by running:

```
keytool -list -v -keystore your-keystore.jks
```

Look for the `SHA256:` fingerprint, format: `AA:BB:CC:...`
Keep the colon-separated uppercase format Google expects, e.g.
`"AA:BB:CC:DD:..."`.

Note: the JSON file itself must stay comment-free — Google's App Links
verifier fetches it as strict JSON, which is why this note lives here
instead of inside the file.

If you also install from the Play Store, add Play App Signing's certificate
fingerprint as a second entry in the `sha256_cert_fingerprints` array.
