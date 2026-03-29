const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const BookingAgent = require('../models/bookingAgent');
const User = require('../models/users');
const { verifyVapiSignature } = require('../middleware/vapiAuth');
const vapiClient = require('./vapi'); // import vapi functions

// Middleware to verify Vapi requests (optional but recommended)
// router.use(verifyVapiSignature);

/**
 * Vapi Webhook - handles tool calls from Vapi assistants
 * Vapi sends POST requests when assistant invokes a tool
 */
router.post('/webhook', async (req, res) => {
  try {
    const { callId, toolName, toolCallId, arguments: args } = req.body;

    console.log(`🔧 Vapi tool call: ${toolName}`, args);

    let result;

    switch (toolName) {
      case 'check_availability':
        result = await handleCheckAvailability(args);
        break;

      case 'create_booking':
        result = await handleCreateBooking(args, callId);
        break;

      default:
        return res.status(400).json({
          error: `Unknown tool: ${toolName}`
        });
    }

    // Respond with tool result
    res.json({
      result: result
    });

  } catch (error) {
    console.error('❌ Vapi webhook error:', error);
    res.json({
      result: {
        error: error.message || 'An error occurred processing your request'
      }
    });
  }
});

/**
 * Check if a date and time slot is available
 */
async function handleCheckAvailability({ date, time }) {
  // Validate inputs
  if (!date || !time) {
    return { error: 'Date and time are required' };
  }

  // Normalize time to 4-digit format (HHMM) for consistency with existing booking system
  // If time is in HH:MM format, convert to HHMM
  let normalizedTime = time;
  if (time.includes(':')) {
    const [hours, minutes] = time.split(':');
    normalizedTime = `${hours.padStart(2, '0')}${minutes}`;
  }

  // Check if slot exists in database
  const existing = await Booking.findOne({
    date,
    time: normalizedTime
  });

  if (existing) {
    return {
      available: false,
      message: `Sorry, the slot on ${date} at ${time} is already booked. Would you like to try a different time?`
    };
  }

  return {
    available: true,
    message: `Yes, ${date} at ${time} is available! Would you like me to book this slot?`
  };
}

/**
 * Create a new booking
 */
async function handleCreateBooking({ customerName, customerPhone, customerEmail, date, time, service }, callId) {
  try {
    // Validate required fields
    if (!customerName || !customerPhone || !date || !time) {
      return {
        success: false,
        error: 'Missing required information: name, phone, date, and time are required'
      };
    }

    // Normalize time to HHMM format
    let normalizedTime = time;
    if (time.includes(':')) {
      const [hours, minutes] = time.split(':');
      normalizedTime = `${hours.padStart(2, '0')}${minutes}`;
    }

    // Check availability
    const existing = await Booking.findOne({
      date,
      time: normalizedTime
    });

    if (existing) {
      return {
        success: false,
        error: `That slot (${date} at ${time}) is no longer available. Please choose a different time.`
      };
    }

    // Determine botId from callId (associate call with agent)
    let botId = 'vapi-unknown';
    try {
      if (callId) {
        const callDetails = await vapiClient.getCall(callId);
        const assistantId = callDetails.data.assistantId;
        if (assistantId) {
          const agent = await BookingAgent.findOne({ vapiAssistantId: assistantId });
          if (agent) {
            botId = agent.botId;
          } else {
            console.warn(`⚠️  No agent found for assistantId: ${assistantId}`);
          }
        }
      }
    } catch (err) {
      console.warn('⚠️  Could not fetch call details, proceeding without botId:', err.message);
    }

    // Create booking
    const booking = await Booking.create({
      botId,
      name: customerName,
      phone: customerPhone,
      email: customerEmail || '',
      date,
      time: normalizedTime,
      service: service || 'General',
      source: 'vapi-call'
    });

    console.log(`✅ Booking created: ${booking._id} for bot: ${botId}`);

    // Format date and time for user-friendly response
    const [year, month, day] = date.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    // Return success
    return {
      success: true,
      bookingId: booking._id.toString(),
      message: `Great! Your appointment has been confirmed for ${formattedDate} at ${time}. You'll receive a confirmation shortly.`,
      bookingDetails: {
        date: formattedDate,
        time,
        customerName,
        customerPhone
      }
    };

  } catch (error) {
    console.error('❌ Create booking error:', error);
    return {
      success: false,
      error: 'Failed to create booking due to a system error'
    };
  }
}

/**
 * Optional: Handle call status webhooks from Vapi
 * Useful for tracking call metrics and analytics
 */
router.post('/call-status', async (req, res) => {
  try {
    const { callId, status, transcript, duration, endReason } = req.body;

    console.log(`📞 Call ${callId} status: ${status}`);

    // You can store call logs/analytics here if needed
    // e.g., update BookingAgent with last call time, track metrics

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Call status webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
