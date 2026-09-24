const express = require('express');
const cors = require('cors');
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Directory for storing generated codes (optional – can serve directly)
const OUTPUT_DIR = path.join(__dirname, 'generated');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/* ─────────────────────────────────────────────
   HELPER: Generate QR Code with the `qrcode` library
   Returns a base64 Data URL for easy <img> embedding
   ───────────────────────────────────────────── */
async function generateQRCode(data, options = {}) {
  const defaultOptions = {
    width: options.width || 400,
    margin: options.margin || 2,
    color: {
      dark: options.darkColor || '#000000',
      light: options.lightColor || '#ffffff',
    },
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
  };

  // If a logo is provided, we composite it onto the QR code
  if (options.logo) {
    // Generate QR as PNG buffer first
    const qrBuffer = await QRCode.toBuffer(data, { ...defaultOptions, type: 'png' });

    // Use bwip-js for logo compositing (simpler than canvas on server)
    const composite = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: data,
      scale: 3,
      includetext: false,
      backgroundcolor: options.lightColor || 'ffffff',
      barcolor: options.darkColor || '000000',
      // Logo embedding via bwip-js is limited; we return QR without logo here
      // For full logo support, use the `qr-code-forge` package
    });
    return `data:image/png;base64,${composite.toString('base64')}`;
  }

  // Standard QR code
  const dataUrl = await QRCode.toDataURL(data, defaultOptions);
  return dataUrl;
}

/* ─────────────────────────────────────────────
   HELPER: Generate 1D/2D Barcode with bwip-js
   ───────────────────────────────────────────── */
async function generateBarcode(data, bcid, options = {}) {
  const opts = {
    bcid,                    // e.g. 'code128', 'ean13', 'qrcode', 'datamatrix', 'pdf417'
    text: data,
    scale: options.scale || 3,
    height: options.height || 10,  // in mm for 1D barcodes
    includetext: options.includetext !== false,
    textxalign: 'center',
    backgroundcolor: options.backgroundcolor || 'ffffff',
    barcolor: options.barcolor || '000000',
  };

  // 2D barcodes need size specification
  if (['qrcode', 'datamatrix', 'pdf417', 'azteccode'].includes(bcid)) {
    opts.scale = options.scale || 3;
    delete opts.height;
  }

  const buffer = await bwipjs.toBuffer(opts);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/* ─────────────────────────────────────────────
   HELPER: Build vCard 3.0 string
   ───────────────────────────────────────────── */
function buildVCard(data) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${data.lastName || ''};${data.firstName || ''};;;`,
    `FN:${data.firstName || ''} ${data.lastName || ''}`.trim(),
    data.organization ? `ORG:${data.organization}` : '',
    data.title ? `TITLE:${data.title}` : '',
    data.phone ? `TEL;TYPE=CELL:${data.phone}` : '',
    data.email ? `EMAIL:${data.email}` : '',
    data.website ? `URL:${data.website}` : '',
    data.address ? `ADR;TYPE=WORK:;;${data.address};;;;` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═════════════════════════════════════════════
   API ROUTES
   ═════════════════════════════════════════════ */

/**
 * POST /api/generate
 * Unified endpoint – accepts { type, data, options }
 * Returns { success, codeType, image (base64 data URL), mimeType }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { type, data, options = {} } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing "type" or "data" field' });
    }

    let imageDataUrl;
    let codeType;

    switch (type) {
      /* ────────── 1D Barcodes ────────── */
      case 'barcode-code128':
        imageDataUrl = await generateBarcode(data, 'code128', options);
        codeType = '1D Code128';
        break;

      case 'barcode-ean13':
        imageDataUrl = await generateBarcode(data, 'ean13', options);
        codeType = '1D EAN-13';
        break;

      case 'barcode-upca':
        imageDataUrl = await generateBarcode(data, 'upca', options);
        codeType = '1D UPC-A';
        break;

      /* ────────── 2D Barcodes ────────── */
      case 'qrcode':
        imageDataUrl = await generateQRCode(data, options);
        codeType = 'QR Code';
        break;

      case 'datamatrix':
        imageDataUrl = await generateBarcode(data, 'datamatrix', options);
        codeType = 'Data Matrix';
        break;

      case 'pdf417':
        imageDataUrl = await generateBarcode(data, 'pdf417', options);
        codeType = 'PDF417';
        break;

      /* ────────── vCard ────────── */
      case 'vcard': {
        const vcardString = buildVCard(data);
        imageDataUrl = await generateQRCode(vcardString, options);
        codeType = 'vCard QR';
        break;
      }

      /* ────────── PDF ────────── */
      case 'pdf': {
        // For PDF, the user provides a URL (or we generate a hosted link)
        // The QR code simply encodes that URL
        const pdfUrl = data.url || data;
        imageDataUrl = await generateQRCode(pdfUrl, options);
        codeType = 'PDF QR';
        break;
      }

      /* ────────── Image Display ────────── */
      case 'image': {
        // Encode an image URL (or a data URL / base64)
        const imageUrl = data.url || data;
        imageDataUrl = await generateQRCode(imageUrl, options);
        codeType = 'Image QR';
        break;
      }

      /* ────────── Social Media ────────── */
      case 'social': {
        // Build a profile URL or a multi-platform landing page
        let socialUrl = data.url;
        if (!socialUrl && data.platform) {
          const platformUrls = {
            instagram: 'https://instagram.com/',
            twitter: 'https://twitter.com/',
            linkedin: 'https://linkedin.com/in/',
            facebook: 'https://facebook.com/',
            youtube: 'https://youtube.com/@',
            tiktok: 'https://tiktok.com/@',
            github: 'https://github.com/',
          };
          socialUrl = (platformUrls[data.platform.toLowerCase()] || '') + (data.username || '');
        }
        imageDataUrl = await generateQRCode(socialUrl || data, options);
        codeType = 'Social Media QR';
        break;
      }

      /* ────────── Video ────────── */
      case 'video': {
        // Encode a video URL (YouTube, Vimeo, direct MP4, etc.)
        const videoUrl = data.url || data;
        imageDataUrl = await generateQRCode(videoUrl, options);
        codeType = 'Video QR';
        break;
      }

      /* ────────── Business Page ────────── */
      case 'business': {
        const businessUrl = data.url || data;
        imageDataUrl = await generateQRCode(businessUrl, options);
        codeType = 'Business Page QR';
        break;
      }

      /* ────────── Batch generation ────────── */
      case 'batch': {
        // data is an array of { type, data, options }
        const results = await Promise.all(
          data.map(async (item) => {
            try {
              const img = await generateQRCode(item.data, item.options || {});
              return { success: true, input: item.data, image: img };
            } catch (err) {
              return { success: false, input: item.data, error: err.message };
            }
          })
        );
        return res.json({ success: true, results });
      }

      default:
        return res.status(400).json({ error: `Unsupported type: ${type}` });
    }

    res.json({
      success: true,
      codeType,
      image: imageDataUrl,
      mimeType: 'image/png',
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

/**
 * POST /api/barcode
 * Dedicated endpoint for raw 1D/2D barcode generation (no QR wrapper)
 */
app.post('/api/barcode', async (req, res) => {
  try {
    const { bcid, text, scale, height, includetext } = req.body;

    if (!bcid || !text) {
      return res.status(400).json({ error: 'Missing "bcid" or "text"' });
    }

    const opts = {
      bcid,
      text,
      scale: scale || 3,
      includetext: includetext !== false,
      textxalign: 'center',
    };

    if (!['qrcode', 'datamatrix', 'pdf417', 'azteccode'].includes(bcid)) {
      opts.height = height || 10;
    }

    const buffer = await bwipjs.toBuffer(opts);
    res.json({
      success: true,
      bcid,
      image: `data:image/png;base64,${buffer.toString('base64')}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/types
 * Returns the list of supported types for the frontend
 */
app.get('/api/types', (req, res) => {
  res.json({
    barcodes1D: [
      { id: 'barcode-code128', label: 'Code 128' },
      { id: 'barcode-ean13', label: 'EAN-13' },
      { id: 'barcode-upca', label: 'UPC-A' },
    ],
    barcodes2D: [
      { id: 'qrcode', label: 'QR Code' },
      { id: 'datamatrix', label: 'Data Matrix' },
      { id: 'pdf417', label: 'PDF417' },
    ],
    categories: [
      { id: 'vcard', label: 'vCard (Digital Business Card)' },
      { id: 'pdf', label: 'PDF Document' },
      { id: 'image', label: 'Image Display' },
      { id: 'social', label: 'Social Media' },
      { id: 'video', label: 'Video' },
      { id: 'business', label: 'Business Page' },
    ],
  });
});

// Serve frontend for any non-API route
app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Barcode/QR system running at http://localhost:${PORT}`);
});