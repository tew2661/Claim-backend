import { BadGatewayException } from "@nestjs/common";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const saveBase64File = async (base64String: string, basePath: string, filenamePrefix: string) => {
    // ตรวจสอบว่ามี Data URI หรือไม่
    const dataUriRegex = /^data:(.+);base64,(.*)$/;
    const matches = base64String.match(dataUriRegex);
    let base64Data = base64String;
    let ext = 'png'; // ค่า default

    if (matches) {
        // ตัวอย่าง: matches[1] = "image/png", matches[2] = Base64 data
        base64Data = matches[2];
        const mimeType = matches[1];

        if (!mimeType.startsWith('image/')) {
            throw new BadGatewayException("Invalid file type. Only image files are allowed.")
        }

        if (mimeType === 'image/jpeg') {
            ext = 'jpg';
        } else if (mimeType === 'image/png') {
            ext = 'png';
        } else if (mimeType === 'image/gif') {
            ext = 'gif';
        } else if (mimeType === 'image/tiff') {
            ext = 'tiff';
        } else if (mimeType === 'image/tif') {
            ext = 'tif';
        } else if (mimeType === 'image/bmp') {
            ext = 'bmp';
        } else if (mimeType === 'image/webp') {
            ext = 'webp';
        } else if (mimeType === 'image/svg+xml') {
            ext = 'svg';
        } else if (mimeType === 'image/x-icon') {
            ext = 'ico';
        } else if (mimeType === 'image/heif') {
            ext = 'heif';
        } else if (mimeType === 'image/heic') {
            ext = 'heic';
        } else if (mimeType === 'image/jp2') {
            ext = 'jp2';
        } else if (mimeType === 'image/jpx') {
            ext = 'jpx';
        } else if (mimeType === 'image/jxr') {
            ext = 'jxr';
        } else if (mimeType === 'image/vnd.adobe.photoshop') {
            ext = 'psd';
        } else {
            ext = 'png'; // ค่าเริ่มต้นหากไม่มีการแมปที่ตรงกัน
        }
    }

    // กำหนดชื่อไฟล์โดยใช้ prefix + timestamp
    const fileName = `${filenamePrefix}-${Date.now()}.${ext}`;
    // กำหนด path ที่จะบันทึกไฟล์ (เช่นในโฟลเดอร์ uploads ใน root project)
    const uploadDir = basePath;

    // ตรวจสอบว่าโฟลเดอร์ uploads มีอยู่หรือไม่ หากไม่มีให้สร้างใหม่
    try {
        await mkdir(uploadDir, { recursive: true });
    } catch (err) {
        console.error('Error creating upload directory:', err);
    }

    const filePath = join(uploadDir, fileName);
    const fileBuffer = Buffer.from(base64Data, 'base64');
    await writeFile(filePath, fileBuffer);
    return filePath;
}

export { saveBase64File }