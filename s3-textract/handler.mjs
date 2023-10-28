import AWS from 'aws-sdk';

const textract = new AWS.Textract();
const s3 = new AWS.S3();

export const detectText = async (event) => {
  // S3 のイベントからファイルの情報を取得
  const bucket = event.Records[0].s3.bucket.name;
  const objectKey = event.Records[0].s3.object.key;

  const params = {
    DocumentLocation: {
      S3Object: {
        Bucket: bucket,
        Name: objectKey
      }
    }
  };

  try {
    // Textractを呼び出し、テキストを抽出
    const response = await textract.startDocumentTextDetection(params).promise();
    
    // Textractのジョブが完了するのを待つ
    const jobId = response.JobId;
    await waitForJobCompletion(jobId);

    // テキストを取得
    const text = await getTextractText(jobId);
    
    // テキストを使用して必要な処理を行う
    const putparams = {
      Bucket: '20230919-text-bucket',
      Key: 'sample.txt',
      Body: text,
      ContentType: 'text/plain',
    };

    await s3.putObject(putparams).promise();
    console.log("Text file uploaded successfully.");

    return {
      statusCode: 200,
      body: 'Text file uploaded successfully.'
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error.message)
    };
  }
};

// Textractのジョブが完了するのを待つユーティリティ関数
async function waitForJobCompletion(jobId) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  let status = 'IN_PROGRESS';

  while (status === 'IN_PROGRESS') {
    const response = await textract.getDocumentTextDetection({ JobId: jobId }).promise();
    status = response.JobStatus;

    if (status === 'IN_PROGRESS') {
      await delay(5000); // 5秒待機
    }
  }
}

// Textractからテキストを取得するユーティリティ関数
async function getTextractText(jobId) {
  const response = await textract.getDocumentTextDetection({ JobId: jobId }).promise();
  const text = response.Blocks
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n');
  
  return text;
}
