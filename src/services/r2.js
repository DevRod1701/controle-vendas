import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// 1. Configura o Cliente usando as variáveis do .env
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${import.meta.env.VITE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const PUBLIC_URL_BASE = import.meta.env.VITE_R2_PUBLIC_URL;

/**
 * Envia arquivo para o R2 e retorna o link público.
 */
export const uploadToR2 = async (file) => {
  // Cria nome único para não substituir arquivos iguais (timestamp + nome limpo)
  const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;

  try {
    // --- CORREÇÃO AQUI ---
    // Converte o arquivo para ArrayBuffer (dados brutos)
    // Isso evita o erro de "getReader is not a function"
    const fileBuffer = await file.arrayBuffer();
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: new Uint8Array(fileBuffer), // Envia como dados binários simples
      ContentType: file.type,
      ContentLength: file.size, // Boa prática informar o tamanho
    });

    // Envia para a nuvem
    await r2.send(command);

    // Retorna o link público para salvar no banco
    return `${PUBLIC_URL_BASE}/${fileName}`;
  } catch (error) {
    console.error("❌ Erro no upload R2:", error);
    alert("Erro ao enviar imagem. Verifique o console.");
    return null;
  }
};