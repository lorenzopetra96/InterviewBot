const axios = require('axios');
const SUBSCRIPTION_KEY = 'e187e55c2b3f4440817b8618964a09db'
if (!SUBSCRIPTION_KEY) {
  throw new Error('Missing the AZURE_SUBSCRIPTION_KEY environment variable')
}
function bingWebSearch(query) {
  
    
}
const query = process.argv[2] || 'Microsoft Cognitive Services'
bingWebSearch(query)