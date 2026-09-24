const codeTypeSelect = document.getElementById('codeType');
const formArea = document.getElementById('formArea');
const generateBtn = document.getElementById('generateBtn');
const resultArea = document.getElementById('resultArea');
const resultImage = document.getElementById('resultImage');
const downloadLink = document.getElementById('downloadLink');
const copyBtn = document.getElementById('copyBtn');
const resultMeta = document.getElementById('resultMeta');

/* ─────────────────────────────────────────────
   DYNAMIC FORM RENDERER
   Returns HTML string for the form based on type
   ───────────────────────────────────────────── */
function renderForm(type) {
  const templates = {
    /* ── 1D Barcodes ── */
    'barcode-code128': `
      <div class="field">
        <label>Data to encode (alphanumeric)</label>
        <input type="text" id="inputData" placeholder="ABC-12345" value="ABC-12345" />
      </div>`,

    'barcode-ean13': `
      <div class="field">
        <label>13-digit number (EAN-13)</label>
        <input type="text" id="inputData" placeholder="5901234123457" value="5901234123457" maxlength="13" />
      </div>`,

    'barcode-upca': `
      <div class="field">
        <label>12-digit number (UPC-A)</label>
        <input type="text" id="inputData" placeholder="012345678905" value="012345678905" maxlength="12" />
      </div>`,

    /* ── 2D Plain ── */
    qrcode: `
      <div class="field">
        <label>Text / URL</label>
        <textarea id="inputData" placeholder="https://example.com">https://example.com</textarea>
      </div>`,

    datamatrix: `
      <div class="field">
        <label>Data</label>
        <input type="text" id="inputData" placeholder="SHIPMENT-000123" value="SHIPMENT-000123" />
      </div>`,

    pdf417: `
      <div class="field">
        <label>Data</label>
        <textarea id="inputData" placeholder="Multi-line or long data">Sample PDF417 data</textarea>
      </div>`,

    /* ── vCard ── */
    vcard: `
      <div class="field"><label>First Name</label><input type="text" id="vcFirst" value="Jane" /></div>
      <div class="field"><label>Last Name</label><input type="text" id="vcLast" value="Doe" /></div>
      <div class="field"><label>Phone</label><input type="tel" id="vcPhone" value="+15551234567" /></div>
      <div class="field"><label>Email</label><input type="email" id="vcEmail" value="jane@example.com" /></div>
      <div class="field"><label>Organization</label><input type="text" id="vcOrg" value="Acme Corp" /></div>
      <div class="field"><label>Title</label><input type="text" id="vcTitle" value="CTO" /></div>
      <div class="field"><label>Website</label><input type="url" id="vcWebsite" value="https://acme.com" /></div>`,

    /* ── PDF ── */
    pdf: `
      <div class="field">
        <label>PDF URL</label>
        <input type="url" id="inputUrl" placeholder="https://example.com/document.pdf" value="https://example.com/document.pdf" />
      </div>
      <p style="font-size:0.8rem;color:#64748b;">The QR code encodes the URL. Host your PDF online and paste the link.</p>`,

    /* ── Image ── */
    image: `
      <div class="field">
        <label>Image URL</label>
        <input type="url" id="inputUrl" placeholder="https://example.com/photo.jpg" value="https://example.com/photo.jpg" />
      </div>
      <p style="font-size:0.8rem;color:#64748b;">Encode a direct image URL so scanning opens the image.</p>`,

    /* ── Social Media ── */
    social: `
      <div class="field">
        <label>Platform</label>
        <select id="socialPlatform">
          <option value="instagram">Instagram</option>
          <option value="twitter">Twitter / X</option>
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="github">GitHub</option>
          <option value="custom">Custom URL</option>
        </select>
      </div>
      <div class="field" id="socialUsernameField">
        <label>Username / Handle</label>
        <input type="text" id="socialUsername" placeholder="yourhandle" />
      </div>
      <div class="field" id="socialUrlField" style="display:none;">
        <label>Full Profile URL</label>
        <input type="url" id="socialUrl" placeholder="https://..." />
      </div>`,

    /* ── Video ── */
    video: `
      <div class="field">
        <label>Video URL</label>
        <input type="url" id="inputUrl" placeholder="https://youtube.com/watch?v=..." value="https://youtube.com/watch?v=..." />
      </div>
      <p style="font-size:0.8rem;color:#64748b;">Works with YouTube, Vimeo, or direct MP4 links.</p>`,

    /* ── Business Page ── */
    business: `
      <div class="field">
        <label>Business Page URL</label>
        <input type="url" id="inputUrl" placeholder="https://yourbusiness.com" value="https://yourbusiness.com" />
      </div>
      <p style="font-size:0.8rem;color:#64748b;">Encode your website, landing page, or Google Business profile.</p>`,
  };

  formArea.innerHTML = templates[type] || '<p>Select a type above.</p>';

  // Special handler for social media
  if (type === 'social') {
    const platformSelect = document.getElementById('socialPlatform');
    const usernameField = document.getElementById('socialUsernameField');
    const urlField = document.getElementById('socialUrlField');

    platformSelect.addEventListener('change', () => {
      if (platformSelect.value === 'custom') {
        usernameField.style.display = 'none';
        urlField.style.display = 'block';
      } else {
        usernameField.style.display = 'block';
        urlField.style.display = 'none';
      }
    });
  }
}

/* ─────────────────────────────────────────────
   COLLECT DATA FROM THE FORM
   ───────────────────────────────────────────── */
function collectData(type) {
  const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

  switch (type) {
    case 'vcard':
      return {
        type: 'vcard',
        data: {
          firstName: getValue('vcFirst'),
          lastName: getValue('vcLast'),
          phone: getValue('vcPhone'),
          email: getValue('vcEmail'),
          organization: getValue('vcOrg'),
          title: getValue('vcTitle'),
          website: getValue('vcWebsite'),
        },
      };

    case 'pdf':
    case 'image':
    case 'video':
    case 'business':
      return { type, data: { url: getValue('inputUrl') } };

    case 'social': {
      const platform = getValue('socialPlatform');
      if (platform === 'custom') {
        return { type: 'social', data: { url: getValue('socialUrl') } };
      }
      return { type: 'social', data: { platform, username: getValue('socialUsername') } };
    }

    default:
      return { type, data: getValue('inputData') };
  }
}

/* ─────────────────────────────────────────────
   GENERATE
   ───────────────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
  const type = codeTypeSelect.value;
  const payload = collectData(type);

  if (!payload.data || (typeof payload.data === 'string' && !payload.data)) {
    alert('Please fill in the required field(s).');
    return;
  }

  // Options
  const options = {
    width: parseInt(document.getElementById('optSize').value) || 400,
    darkColor: document.getElementById('optDark').value,
    lightColor: document.getElementById('optLight').value,
    margin: parseInt(document.getElementById('optMargin').value) || 2,
  };

  payload.options = options;

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating…';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!json.success) throw new Error(json.error || 'Generation failed');

    resultImage.src = json.image;
    downloadLink.href = json.image;
    downloadLink.download = `${type}-${Date.now()}.png`;
    resultMeta.textContent = `Type: ${json.codeType} · Generated: ${new Date(json.generatedAt).toLocaleTimeString()}`;
    resultArea.style.display = 'block';
    resultArea.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Code';
  }
});

/* ─────────────────────────────────────────────
   COPY DATA URL TO CLIPBOARD
   ───────────────────────────────────────────── */
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultImage.src);
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => (copyBtn.textContent = '📋 Copy Data URL'), 1500);
  } catch {
    alert('Clipboard not available. Right-click the image and copy the address.');
  }
});

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
codeTypeSelect.addEventListener('change', (e) => {
  renderForm(e.target.value);
  resultArea.style.display = 'none';
});

// Initial render
renderForm(codeTypeSelect.value);