# PetMood — Chrome Web Store Submission Text

Copy-paste into the Web Store Developer Dashboard form. (This file is NOT part
of the extension ZIP — keep it in the repo only.)

---

## Short description (≤ 132 chars)

```
Your own pet pops up with cute animations while you browse. All photo
processing runs locally — nothing is uploaded.
```
(123 chars)

---

## Detailed description

```
PetMood brings your pet to you while you work.

Upload photos of your dog, cat, or any pet, and PetMood removes the
background and turns them into playful animations that appear on the page
every so often — a little burst of joy in the middle of your day.

HOW IT WORKS
1. Open the extension and add photos of your pet.
2. PetMood removes the background from each photo automatically. All AI
   processing happens locally in your browser.
3. While you browse, your pet pops up with one of 18 animations — running
   across the screen, blowing kisses, raining down, and more.

YOU'RE IN CONTROL
• Choose how often your pet appears (every 10, 30, or 60 minutes, or a custom
  interval).
• Turn it on or off any time from the popup.

PRIVATE BY DESIGN
• Your photos never leave your device — they're stored locally in your browser.
• PetMood reads nothing from the pages you visit and sends no data anywhere.
• The only network request is a one-time download of the open-source
  background-removal AI model, used purely for local processing.
```

---

## Single purpose statement (≤ 1000 chars)

```
PetMood displays animations made from the user's own uploaded pet photos as a
periodic overlay on the web pages they are viewing, to provide a small, cheerful
break during browsing. The user uploads photos, PetMood removes their
backgrounds locally, and on a timer the extension shows one of several
animations of the pet on the current tab.
```

---

## Permission justifications

### alarms
```
Used to schedule the periodic timer that decides when the pet animation
appears (every 10/30/60 minutes or a user-set custom interval). A single
repeating chrome.alarms alarm drives this; no other use.
```

### storage
```
Used via chrome.storage.local to save the user's own settings on their device:
their name, pet name, how often the pet appears, the blocked-site list, and the
on/off state. Small key-value data only. Nothing is sent off-device.
```

### unlimitedStorage
```
The user can store up to 100 pet photos (original image plus a
background-removed cutout) in the browser's local IndexedDB. unlimitedStorage
removes the default storage quota so these images fit. All images stay on the
user's device and are never uploaded.
```

### Host permissions / broad content-script match (`<all_urls>`)
```
The content script runs on all sites because the pet appears on whatever page
the user is viewing when the timer fires, and that firing happens in the
background without a click, so the script must already be present. The content
script only renders the user's own local pet images as an overlay — it reads no
page content and sends nothing to any website.
```

---

## Remote code
```
Select: "No, I am not using remote code."
```
Rationale (for your own reference, not the form): the WebAssembly inference
runtime is bundled inside the package. The extension fetches only the
background-removal model's data weights (briaai/RMBG-1.4) from Hugging Face for
on-device processing — model data, not executable code.

---

## Data collection disclosures

Leave ALL data-type checkboxes UNTICKED (PetMood collects nothing):
- Personally identifiable info — ✗
- Health info — ✗
- Financial/payment info — ✗
- Authentication info — ✗
- Personal communications — ✗
- Location — ✗
- Web history — ✗
- User activity — ✗
- Website content — ✗

Tick all three confirmations:
- [x] I do not sell or transfer user data to third parties (outside approved use cases)
- [x] I do not use or transfer user data for purposes unrelated to the item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending

Privacy policy URL: https://tkddnjs-dlqslek.github.io/petmood/privacy-policy.html

---

## Listing meta

- Category: Fun (or Productivity)
- Language: English
- Privacy policy URL: https://tkddnjs-dlqslek.github.io/petmood/privacy-policy.html
- Homepage / Support URL (optional): https://github.com/tkddnjs-dlqslek/petmood

---

## Screenshots needed (you must capture these)

1280×800 or 640×400, PNG (no alpha) or JPEG, 1–5 images. Suggested:
1. Onboarding — name + photo upload screen
2. Photos tab — the grid of pet cutouts
3. A pet animation playing over a real web page (e.g. a news site)
4. Notifications tab — frequency + blocked sites
5. The popup — toggle + test buttons
