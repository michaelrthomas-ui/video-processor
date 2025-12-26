import express from 'express';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import ffmpeg from 'fluent-ffmpeg';
import { createWriteStream, unlinkSync, mkdirSync, existsSync } from 'fs';
import { get } from 'https';
import { get as httpGet } from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
     origin: ['https://cloudinary-video-com-doh6.bolt.host', 'http://localhost:5173'],
     credentials: true
   }));
app.use(express.json());

// Configure Cloudinary
console.log('=== CLOUDINARY CONFIG ===');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
console.log('CLOUDINARY_API_SECRET exists:', !!process.env.CLOUDINARY_API_SECRET);
console.log('CLOUDINARY_API_SECRET length:', process.env.CLOUDINARY_API_SECRET?.length);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

console.log('Cloudinary config set');
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Video processor is running' });
});

// Download file from URL
function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filename);
    const protocol = url.startsWith('https') ? get : httpGet;
    
    protocol(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filename);
      });
    }).on('error', (err) => {
      unlinkSync(filename);
      reject(err);
    });
  });
}

// Concatenate videos endpoint
app.post('/concatenate', async (req, res) => {
  const { intro_url, demo_url, outro_url } = req.body;
  
  if (!intro_url || !demo_url) {
    return res.status(400).json({ 
      error: 'intro_url and demo_url are required' 
    });
  }

  const tempFiles = [];
  const timestamp = Date.now();
  
  try {
    console.log('Starting video concatenation...');
    console.log('Intro:', intro_url);
    console.log('Demo:', demo_url);
    console.log('Outro:', outro_url || 'none');
    
    // Download videos from Cloudinary
    console.log('Downloading videos...');
    const introFile = `./temp/intro_${timestamp}.mp4`;
    const demoFile = `./temp/demo_${timestamp}.mp4`;
    
    await downloadFile(intro_url, introFile);
    tempFiles.push(introFile);
    console.log('Downloaded intro');
    
    await downloadFile(demo_url, demoFile);
    tempFiles.push(demoFile);
    console.log('Downloaded demo');
    
    let outroFile = null;
    if (outro_url) {
      outroFile = `./temp/outro_${timestamp}.mp4`;
      await downloadFile(outro_url, outroFile);
      tempFiles.push(outroFile);
      console.log('Downloaded outro');
    }
    
    // Concatenate with FFmpeg
    console.log('Concatenating videos with FFmpeg...');
    const outputFile = `./temp/combined_${timestamp}.mp4`;
    
    await new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      // Add inputs
      command.input(introFile);
      command.input(demoFile);
      if (outroFile) {
        command.input(outroFile);
      }
      
      // Build filter complex for concatenation
      const numInputs = outroFile ? 3 : 2;
      const filterComplex = [];
      
      for (let i = 0; i < numInputs; i++) {
        filterComplex.push(`[${i}:v:0][${i}:a:0]`);
      }
      
      const concatFilter = `${filterComplex.join('')}concat=n=${numInputs}:v=1:a=1[outv][outa]`;
      
      command
        .complexFilter(concatFilter)
        .map('[outv]')
        .map('[outa]')
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-c:a aac',
          '-b:a 128k'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + Math.round(progress.percent) + '% done');
        })
        .on('end', () => {
          console.log('FFmpeg processing completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err.message);
          reject(err);
        })
        .save(outputFile);
    });
    
    console.log('Uploading to Cloudinary...');
    
// Upload result to Cloudinary
const uploadResult = await cloudinary.uploader.upload(outputFile, {
  resource_type: 'video',
  folder: 'combined-videos',
  public_id: `combined_${timestamp}`
});

console.log('Upload successful:', uploadResult.secure_url);
    
    // Cleanup temp files
    tempFiles.forEach(file => {
      try {
        unlinkSync(file);
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }
    });
    
    try {
      unlinkSync(outputFile);
    } catch (err) {
      console.error('Error deleting output file:', err);
    }
    
    res.json({ 
      success: true, 
      url: result.secure_url,
      public_id: result.public_id
    });
    
  } catch (error) {
    console.error('Error during concatenation:', error);
    
    // Cleanup on error
    tempFiles.forEach(file => {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch (err) {
        console.error('Error cleaning up:', err);
      }
    });
    
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video processor running on port ${PORT}`);
});
