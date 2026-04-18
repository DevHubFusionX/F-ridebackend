import { renderEmailHtml } from '../src/utils/templateLoader.js';
import fs from 'fs';

const html = renderEmailHtml('otp', { otp: '123 456', headerTitle: 'Verify your identity' });
fs.writeFileSync('scratch/otp-preview.html', html);
console.log('Saved to scratch/otp-preview.html');
