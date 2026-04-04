import axios from 'axios';

async function testQuickLeadCapture() {
  const API_URL = 'http://localhost:3001/api';
  
  try {
    console.log('Testing Lead Creation with minimal payload...');
    const response = await axios.post(`${API_URL}/crm/leads`, {
      name: 'Test Quick Lead',
      phone: '1234567890',
      source: 'website'
    }, {
      // Mock auth if needed, but since we're local we might be able to skip or use a known token
      // For now, let's just see if it gets past validation
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.tid && response.data.status === 'new') {
      console.log('✅ Success: TID generated and status set to new');
    } else {
      console.log('❌ Failure: Missing TID or wrong status');
    }
  } catch (error: any) {
    if (error.response) {
      console.error('❌ Error response:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testQuickLeadCapture();
