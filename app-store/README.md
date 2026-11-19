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
3. In **Signing & Capabilities**, pick your team. Xcode creates the certificates for you.
4. Choose **Any iOS Device**, then **Product → Archive**.
5. In the Organizer, **Distribute App → App Store Connect → Upload**.
6. In [App Store Connect](https://appstoreconnect.apple.com), the build appears under **TestFlight** after a few minutes. Add family and friends as testers.
7. When you're happy, fill in the listing from `LISTING.md`, attach the build and **Submit for Review**.

**Without a Mac:** a cloud service such as Codemagic, or GitHub Actions' macOS machines, can run the same build and upload to TestFlight. It needs an App Store Connect API key, which you create in App Store Connect under **Users and Access → Integrations**.

For each new upload, raise the build number (Xcode: target **App → General → Build**), and the version for a new release.

## Building for Android (optional)

1. `npm install && npm run sync`
2. `npm run open:android` opens Android Studio.
3. **Build → Generate Signed App Bundle**, create an upload key, and keep it safe.
4. Upload the `.aab` in the [Google Play Console](https://play.google.com/console). New personal accounts must run a closed test with 12 testers for 14 days before going public.
