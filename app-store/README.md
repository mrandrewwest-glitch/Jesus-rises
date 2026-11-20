# Publishing Good News Games as an app

The games are packed into real iOS and Android apps with [Capacitor](https://capacitorjs.com). Everything runs from inside the app: no internet needed, no website wrapper.

## What's in the repo

| Path | What it is |
|---|---|
| `*.html`, `bible.js`, `music.js` | The games and menu, unchanged. They still work as a website too. |
| `fonts/` | The Fredoka font (SIL Open Font License), bundled so nothing loads from the internet. |
| `scripts/build-www.js` | Copies the games into `www/` (the folder that goes into the app) and checks every link. |
| `capacitor.config.json` | App name, bundle ID, splash screen and background colours. |
| `ios/` | The Xcode project (Swift Package Manager, so no CocoaPods needed). |
| `android/` | The Android Studio project. |
| `assets/` | Source art for the app icon and splash screens (`design/icon.svg` is the original). |
| `app-store/LISTING.md` | Everything to paste into App Store Connect. |
| `app-store/screenshots/` | iPhone 6.9" and iPad 13" screenshots, ready to upload. |
| `privacy.html`, `support.html` | The privacy policy and support pages Apple requires (website only, not inside the app). |

## Before you submit

1. **Bible permissions.** KJV is public domain. Get written permission from Thomas Nelson (NKJV), Biblica (NIV) and Tyndale (NLT), or remove those versions, before the app is released.
2. **Support email.** Replace `SUPPORT-EMAIL` in `privacy.html` and `support.html`.
3. **Publish the two pages.** Merge into `main` so GitHub Pages serves `privacy.html` and `support.html`.
4. **Bundle ID.** `com.bibleminigames.westy` is set in `capacitor.config.json`, `ios/App/App.xcodeproj` and `android/app/build.gradle`. Register this exact ID in the Apple Developer portal (Certificates, Identifiers & Profiles → Identifiers). It can't change after the first upload.

## After changing a game

```bash
npm install        # first time only (needs Node 22 or newer)
npm run sync       # copies the games into www/ and into both app projects
```

If you change `assets/icon-only.png` or the splash images, run `npm run assets` too.

## Building for iPhone and iPad

You need an [Apple Developer Program](https://developer.apple.com/programs/) membership and either a Mac or a cloud build service.

**On a Mac (with the latest Xcode):**

1. `npm install && npm run sync`
2. `npm run open:ios` opens the project in Xcode.
3. In **Signing & Capabilities**, check the team is yours (Team ID `5MPWZAYMTK` is already set). Xcode creates the certificates for you.
4. Choose **Any iOS Device**, then **Product → Archive**.
5. In the Organizer, **Distribute App → App Store Connect → Upload**.
6. In [App Store Connect](https://appstoreconnect.apple.com), the build appears under **TestFlight** after a few minutes. Add family and friends as testers.
7. When you're happy, fill in the listing from `LISTING.md`, attach the build and **Submit for Review**.

**Without a Mac (GitHub Actions):** `.github/workflows/ios-testflight.yml` builds the app on one of GitHub's Macs and uploads it to TestFlight. The build number goes up by itself each run.

One-time setup:

1. In [App Store Connect](https://appstoreconnect.apple.com), go to **Users and Access → Integrations → App Store Connect API → Team Keys** and click **+**. Name it "GitHub build", give it **Admin** access (needed so Xcode can create the signing certificate in the cloud), and click **Generate**.
2. Note the **Key ID** and the **Issuer ID** (shown above the list of keys), then **Download** the key file `AuthKey_XXXXXXXXXX.p8`. Apple only lets you download it once.
3. In GitHub, open the repository's **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `APP_STORE_CONNECT_KEY_ID`: the Key ID
   - `APP_STORE_CONNECT_ISSUER_ID`: the Issuer ID
   - `APP_STORE_CONNECT_KEY`: open the `.p8` file in a text editor and paste everything, including the `BEGIN` and `END` lines

To build: **Actions → iOS → TestFlight → Run workflow** (the workflow shows there once it is on `main`), or push a tag starting with `ios-`, such as `ios-1.0-1`. When it finishes, the build appears under **TestFlight** in App Store Connect after Apple has processed it.

For each new upload from Xcode, raise the build number (target **App → General → Build**); the GitHub build does this for you. For a new release, raise the version (`MARKETING_VERSION`, currently 1.0).

## Building for Android (Google Play)

`.github/workflows/android.yml` builds the Android app on GitHub. No Android Studio needed.

- **Test APK (no setup):** run **Actions → Android → Run workflow** (or push a tag starting with `android-`). Download **good-news-games-test-apk** from the run's Artifacts and open it on an Android phone or tablet to install it (allow "install unknown apps" when asked).
- **Google Play bundle:** needs an upload key. Add these repository secrets and the same run also produces **good-news-games-play-bundle** (`app-release.aab`):
  - `ANDROID_KEYSTORE_BASE64`: the keystore file, base64-encoded
  - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

  The version code is the workflow run number, so each upload is higher than the last.

Publishing:

1. Create a [Google Play developer account](https://play.google.com/console) (US$25 once).
2. **Create app**: name Good News Games, app or game: **Game**, free.
3. Turn on **Play App Signing** (the default). Google keeps the real signing key; yours is only an upload key, and Google can reset it if it is ever lost.
4. Upload the `.aab` to **Testing → Closed testing** first. New personal accounts need 12 testers opted in for 14 days before the app can go to Production.
5. Fill in the store listing (reuse `LISTING.md` and the screenshots), the content rating questionnaire, the **Target audience** (pick the children's age groups, which brings in Google's Families policy) and **Data safety** (no data collected).

To build on a computer instead: `npm install && npm run sync`, then `npm run open:android` and use Android Studio's **Build → Generate Signed App Bundle**.
