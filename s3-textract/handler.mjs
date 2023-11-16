import AWS from 'aws-sdk';

const textract = new AWS.Textract();
const s3 = new AWS.S3();

export const detectText = async (event) => {
  // S3 のイベントからオブジェクトの情報を取得
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
    console.log(text);
    
    // テキストを使用して必要な処理を行う
    const putparams = {
      Bucket: '20231113-text-bucket',
      Key: 'sample.txt',
      Body: text,
      ContentType: 'text/plain',
    };

    await s3.putObject(putparams).promise();

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

// Textractのジョブが完了するのを待つ
async function waitForJobCompletion(jobId) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  while (true) {
    const response = await textract.getDocumentTextDetection({ JobId: jobId }).promise();

    if (response.JobStatus === 'SUCCEEDED') {
      break;
    }

    if (response.JobStatus === 'IN_PROGRESS') {
      await delay(5000);
    }
  }
}

// Textractからテキストを取得
async function getTextractText(jobId) {
  const response = await textract.getDocumentTextDetection({ JobId: jobId }).promise();
  const text = response.Blocks
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n');
  
  return text;
}