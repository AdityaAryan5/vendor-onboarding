import {nativeAvailable} from '../lib/native-reader';
console.log('PDF text extraction: JavaScript; no external API key required.');
if(process.env.NODE_ENV==='production')console.log('Production: native OCR disabled. Scans route to human review.');
else nativeAvailable().then(ok=>console.log(ok?'Optional local OCR: available.':'Optional local OCR: unavailable. Text PDFs still work; scans route to human review.'));
