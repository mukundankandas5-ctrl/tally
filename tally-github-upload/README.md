# Tally ERP AI Assistant

An accountant-friendly full-stack web app that automates:

- invoice extraction to Tally Purchase voucher XML
- bank statement classification to Tally Payment / Receipt / Contra XML

## Stack

- React + Tailwind CSS frontend
- Node.js + Express backend
- Anthropic Claude via `@anthropic-ai/sdk`
- `pdf-parse` for text extraction from PDFs
- `multer` for upload handling

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and add your Anthropic API key:

   ```bash
   cp .env.example .env
   ```

3. Start the app in development:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173).

## Prototype Mode

If you just want to click through the product quickly:

1. Run `npm run dev`
2. Open [http://localhost:5173](http://localhost:5173)
3. Use the `Load Demo Data` button in either workflow

You do not need an Anthropic API key for demo mode unless you want real extraction/classification.

## Hosting

The simplest hosting path for this app is a single Node web service on Render, because the Express backend already serves the built React frontend.

### Render

1. Push this project to GitHub.
2. Create a new Render service from the repo.
3. Render can detect the included [`render.yaml`](/Users/mukundankandasamy/Desktop/Tally Automation/render.yaml), or you can enter these manually:

   ```bash
   Build Command: npm install && npm run build
   Start Command: npm run start
   ```

4. Set these environment variables in Render:

   ```env
   ANTHROPIC_API_KEY=your_real_key
   PORT=10000
   CORS_ORIGIN=https://your-render-domain.onrender.com
   ```

5. Deploy and open the generated URL.

### Important Note About Learning Memory

The bank-statement learning feature currently stores its learned mappings in a local JSON file under the server folder. On many cloud hosts, local disk can be ephemeral across deploys or restarts.

That means:

- the app itself will still work
- but learned bank mapping memory may not persist reliably forever unless we move it to a database or persistent disk

If you want, the next step can be making the learning memory production-safe with SQLite, Postgres, or Render persistent disk.

## Environment Variables

- `ANTHROPIC_API_KEY`: required for extraction and classification
- `PORT`: optional backend port, defaults to `4000`
- `CORS_ORIGIN`: optional dev frontend origin, defaults to `http://localhost:5173`

## Notes

- Invoice uploads accept JPG, PNG, and PDF.
- Bank statement uploads accept PDF only.
- Bank statements must be text-based PDFs. If the PDF is a scanned image, the API returns a clear OCR guidance message.
- Exported XML uses Tally import envelopes and standard voucher structures.
- Both workflows include an AI instructions box so you can nudge extraction/classification behavior and ask the assistant to revise the current output.
- Bank statement review now shows editable `Debit A/C` and `Credit A/C` columns before XML export.
- The bank workflow can learn recurring mappings from your reviewed corrections and reuse them on future uploads.
