
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// MOCK the auth token - likely need to login first or use a hardcoded one if possible.
// Or we can try to hit the endpoint and see if it is 401, or 400/500 as reported.
// The user said "Auth middleware is failing silently".

async function debug() {
    const baseURL = 'http://localhost:3001/api';

    console.log('--- Testing CRM Endpoints ---');

    try {
        await axios.get(`${baseURL}/crm/clients`);
    } catch (error: any) {
        console.log('GET /crm/clients status:', error.response?.status);
        console.log('GET /crm/clients data:', JSON.stringify(error.response?.data, null, 2));
    }

    try {
        await axios.get(`${baseURL}/crm/dealers`);
    } catch (error: any) {
        console.log('GET /crm/dealers status:', error.response?.status);
        console.log('GET /crm/dealers data:', JSON.stringify(error.response?.data, null, 2));
    }
}

debug();
