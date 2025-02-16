import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import * as mime from 'mime-types'; // ต้องติดตั้ง npm install mime-types

const saveBase64File = async (base64String: string, basePath: string, filenamePrefix: string) => {
    const dataUriRegex = /^data:(.+);base64,(.*)$/;
    const matches = base64String.match(dataUriRegex);
    let base64Data = base64String;
    let ext = 'bin'; // Default เป็น .bin ถ้าไม่รู้ประเภทไฟล์

    if (matches) {
        base64Data = matches[2];
        const mimeType = matches[1];

        if (mimeType) {
            const detectedExt = mime.extension(mimeType); // แปลง MIME type เป็น extension
            if (detectedExt) {
                ext = detectedExt;
            } else {
                console.warn(`⚠️  MIME type "${mimeType}" ไม่สามารถแปลงเป็น extension ได้, ใช้ค่า default .bin`);
            }
        } else {
            console.warn(`⚠️  ไม่พบ MIME type ใน Base64 string, ใช้ค่า default .bin`);
        }
    } else {
        console.warn(`⚠️  Base64 string ไม่ตรงกับ Data URI format, ใช้ค่า default .bin`);
    }

    const fileName = `${filenamePrefix}-${Date.now()}.${ext}`;
    const uploadDir = basePath;

    try {
        await mkdir(uploadDir, { recursive: true });
    } catch (err) {
        console.error('❌ Error creating upload directory:', err);
    }

    const filePath = join(uploadDir, fileName);
    try {
        const fileBuffer = Buffer.from(base64Data, 'base64');
        await writeFile(filePath, fileBuffer);
        return filePath;
    } catch (err) {
        console.error('❌ Error writing file:', err);
        throw err;
    }
};

export { saveBase64File }