const axios = require('axios');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

// Configure axios instance
const vapiClient = axios.create({
  baseURL: VAPI_BASE_URL,
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Create a VAPI assistant for booking
 * Vapi API: https://docs.vapi.ai/api-reference/assistants/create-assistant
 * Required: name, model, voice, firstMessage
 * Optional: serverUrl, temperature, etc.
 */
async function createBookingAssistant(agentData) {
  try {
    // Build working hours string
    const workingHours = {
      days: Array.isArray(agentData.workingDays)
        ? agentData.workingDays.map(day => day.toLowerCase())
        : agentData.workingDays.split(',').map(d => d.trim().toLowerCase()),
      startTime: agentData.startTime || '09:00',
      endTime: agentData.endTime || '18:00'
    };

    // Build the system message content
    const systemMessage = `You are a professional booking assistant for ${agentData.businessName || 'a business'}.

Your responsibilities:
1. Answer questions about the business
2. Schedule appointments/bookings
3. Collect customer information (name, phone, email)
4. Provide availability and booking slots

Working Hours:
- Days: ${workingHours.days.join(', ')}
- Time: ${workingHours.startTime} to ${workingHours.endTime}
- Slot Duration: ${agentData.slotDuration || 30} minutes

Business Category: ${agentData.category || 'General'}

Instructions:
- Be friendly, professional, and helpful
- Always ask for name and phone number when booking
- Confirm booking details before finalizing
- If someone wants to book, ask for preferred date and time
- Check availability using the check_availability tool
- Create booking using the create_booking tool
- If the requested slot is not available, offer alternatives
- End calls professionally

Important:
- Never make up availability - always use the tools
- Be clear about what information you need
- Repeat important details back to the customer

When the conversation ends naturally, thank the caller and say goodbye.`;

    // Build assistant config according to Vapi API spec
    const assistantConfig = {
      name: `${agentData.businessName} - Booking Assistant`,
      model: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        // System message as part of model messages (OpenAI-style)
        messages: [
          {
            role: 'system',
            content: systemMessage
          }
        ]
      },
      // Use a simple voice - either omit for default, or use 'openai' provider
      voice: {
        provider: 'openai', // Use OpenAI's TTS which is built into Vapi
        model: 'tts-1', // or 'tts-1-hd' for higher quality
        voiceId: 'alloy' // Options: alloy, echo, fable, onyx, nova, shimmer
      },
      firstMessage: `Hello! Thank you for calling ${agentData.businessName || 'our business'}. I'm your AI booking assistant. How can I help you today?`
    };

    // Add serverUrl if provided (for webhook tool callbacks)
    if (agentData.serverUrl) {
      assistantConfig.serverUrl = agentData.serverUrl;
    }

    // Create assistant
    const assistant = await vapiClient.post('/assistant', assistantConfig);

    console.log('✅ VAPI Assistant created:', assistant.data.id);
    const assistantId = assistant.data.id;

    // If serverUrl is provided, also add tools to the assistant
    if (agentData.serverUrl) {
      try {
        await addToolsToAssistant(assistantId);
      } catch (toolErr) {
        console.warn('⚠️  Failed to add tools, you may need to add them manually in Vapi dashboard:', toolErr.message);
      }
    }

    return assistant.data;

  } catch (error) {
    console.error('❌ VAPI Assistant creation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Add booking tools to an existing assistant
 * Vapi requires tools to be added separately via /assistant/{id}/tool
 */
async function addToolsToAssistant(assistantId) {
  try {
    const toolsPayload = {
      tools: [
        {
          type: 'function',
          function: {
            name: 'check_availability',
            description: 'Check if a specific date and time slot is available for booking',
            parameters: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format'
                },
                time: {
                  type: 'string',
                  description: 'Time in HH:MM format (24-hour)'
                }
              },
              required: ['date', 'time']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'create_booking',
            description: 'Create a new booking/appointment',
            parameters: {
              type: 'object',
              properties: {
                customerName: {
                  type: 'string',
                  description: 'Full name of the customer'
                },
                customerPhone: {
                  type: 'string',
                  description: 'Phone number of the customer'
                },
                customerEmail: {
                  type: 'string',
                  description: 'Email address of the customer (optional)'
                },
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format'
                },
                time: {
                  type: 'string',
                  description: 'Time in HH:MM format (24-hour)'
                },
                service: {
                  type: 'string',
                  description: 'Type of service/appointment'
                }
              },
              required: ['customerName', 'customerPhone', 'date', 'time']
            }
          }
        }
      ]
    };

    const response = await vapiClient.post(`/assistant/${assistantId}/tool`, toolsPayload);

    console.log('✅ Tools added to assistant:', assistantId);
    return response.data;

  } catch (error) {
    console.error('❌ Add tools to assistant failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update an existing VAPI assistant
 */
async function updateAssistant(assistantId, updates) {
  try {
    const response = await vapiClient.patch(`/assistant/${assistantId}`, updates);
    return response.data;
  } catch (error) {
    console.error('❌ VAPI Assistant update failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get assistant details
 */
async function getAssistant(assistantId) {
  try {
    const response = await vapiClient.get(`/assistant/${assistantId}`);
    return response.data;
  } catch (error) {
    console.error('❌ VAPI Assistant fetch failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Delete assistant
 */
async function deleteAssistant(assistantId) {
  try {
    await vapiClient.delete(`/assistant/${assistantId}`);
    console.log('🗑️ VAPI Assistant deleted:', assistantId);
  } catch (error) {
    console.error('❌ VAPI Assistant delete failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create a phone call (for testing or outbound calls)
 */
async function createCall(phoneNumber, assistantId, options = {}) {
  try {
    const response = await vapiClient.post('/call', {
      phoneNumber,
      assistantId,
      ...options
    });
    return response.data;
  } catch (error) {
    console.error('❌ VAPI Call creation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get call details
 */
async function getCall(callId) {
  try {
    const response = await vapiClient.get(`/call/${callId}`);
    return response.data;
  } catch (error) {
    console.error('❌ VAPI Call fetch failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * End a call
 */
async function endCall(callId) {
  try {
    await vapiClient.post(`/call/${callId}/end`);
    console.log('📞 Call ended:', callId);
  } catch (error) {
    console.error('❌ VAPI Call end failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Purchase a phone number from VAPI
 */
async function purchasePhoneNumber(areaCode = '415', countryCode = 'US') {
  try {
    const response = await vapiClient.post('/phone-number/buy', {
      areaCode,
      countryCode
    });
    return response.data;
  } catch (error) {
    console.error('❌ VAPI Phone number purchase failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * List available phone numbers
 */
async function listPhoneNumbers(areaCode, countryCode = 'US') {
  try {
    const response = await vapiClient.get('/phone-number', {
      params: {
        areaCode,
        countryCode
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ VAPI Phone numbers list failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Assign a phone number to an assistant
 * @param {String} phoneNumber - The phone number in E.164 format (e.g., +1234567890)
 * @param {String} assistantId - The Vapi assistant ID
 */
async function assignPhoneNumberToAssistant(phoneNumber, assistantId) {
  try {
    // First, list phone numbers to find the ID of the phone number
    const response = await vapiClient.get('/phone-number');
    const numbers = response.data || [];

    // Find the phone number object by phoneNumber string
    const targetNumber = numbers.find(num => num.phoneNumber === phoneNumber);

    if (!targetNumber) {
      throw new Error(`Phone number ${phoneNumber} not found in your Vapi account. Please purchase it first in your Vapi dashboard.`);
    }

    const phoneNumberId = targetNumber.id;

    // Update the phone number to assign the assistant
    const updateResponse = await vapiClient.patch(`/phone-number/${phoneNumberId}`, {
      assistantId: assistantId
    });

    console.log(`✅ Phone number ${phoneNumber} assigned to assistant ${assistantId}`);
    return updateResponse.data;
  } catch (error) {
    console.error('❌ Assign phone number failed:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  createBookingAssistant,
  updateAssistant,
  getAssistant,
  deleteAssistant,
  createCall,
  getCall,
  endCall,
  purchasePhoneNumber,
  listPhoneNumbers,
  assignPhoneNumberToAssistant
};