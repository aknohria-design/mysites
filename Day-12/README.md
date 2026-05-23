# Identity Verification Studio

Browser-based demo that:

- launches a verification video room in Jitsi Meet
- captures a live selfie from the webcam
- extracts name and date of birth from an uploaded ID image using OCR
- compares the document face against the captured selfie

## Run locally

Do not open `index.html` directly from File Explorer. Browser ES modules are blocked on `file://` URLs, which causes CORS errors such as `Access to script ... has been blocked by CORS policy`.

```powershell
npm start
```

Then open `http://localhost:4173`.

## How it works

1. Enter the claimed full name and date of birth.
2. Choose how to verify the document:
	- **Upload a valid identity document now** to compare against an uploaded image.
	- **The user already provided the document** to search and match against images stored in `D:\GENAI_Class\Day5\Day-12\IDS`.
3. Start the verification call.
4. Enable the camera and capture a selfie.
5. Click **Validate Uploaded Identity** or **Find Matching Stored ID**, depending on the selected option.

## IDS folder verification

The app now reads image files from the local `IDS` folder through the included Node server.

- Click **Load Selected ID** to preview/OCR one folder document.
- Click **Find Matching Stored ID** after entering the claimed identity and capturing a selfie to compare name, date of birth, and face against every image in the `IDS` folder.
- Results appear in the **Folder verification results** table.

## Notes

- OCR runs with Tesseract.js from CDN.
- Face matching runs with `@vladmandic/face-api` from CDN models.
- Camera access generally requires `localhost` or HTTPS.
- This is a client-side demo. It is useful for prototypes and internal evaluation, not as a production-grade KYC system.