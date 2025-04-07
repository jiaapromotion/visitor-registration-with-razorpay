const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { Twilio } = require('twilio');
require('dotenv').config();

const app = express();
const client = new Twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

app.use(express.static('public'));
app.use(bodyParser.json({
  verify: function (req, res, buf) {
    req.rawBody = buf.toString();
  }
}));

app.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto.createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).send('Invalid signature');
  }

  const payload = req.body;

  if (payload.event === 'payment.captured') {
    console.log("🔔 Webhook received for payment.captured");
    console.log("📦 Full Razorpay payload:", JSON.stringify(payload, null, 2));

    try {
      const payment = payload.payload.payment.entity;
      const comment = payment.notes.comment || "";

      let name = "Guest";
      let phone = null;

      const matches = comment.match(/name=(.*?),\s*phone=([+\d]+)/);
      if (matches) {
        name = matches[1].trim();
        phone = matches[2].trim();
      }

      console.log("✅ Extracted name:", name);
      console.log("✅ Extracted phone:", phone);

      if (!phone) {
        return res.status(400).send("Phone number missing in comment note");
      }

      await client.messages.create({
        from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
        to: 'whatsapp:' + phone,
        body: `Hi ${name}, your payment of ₹50 was successful! 🎉 You're registered for the event.`
      });

      res.status(200).send('Message sent');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error sending WhatsApp');
    }
  } else {
    res.status(200).send('Event ignored');
  }
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
