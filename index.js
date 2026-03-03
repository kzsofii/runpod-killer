const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE;
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

async function getAirtableRecords() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();
  return data.records;
}

async function getAllRunningPods() {
  const res = await fetch("https://rest.runpod.io/v1/pods", {
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` }
  });
  return await res.json();
}

async function deletePod(podId) {
  const res = await fetch(`https://rest.runpod.io/v1/pods/${podId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` }
  });
  return res.ok;
}

async function sendSlackMessage(channel, text) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ channel, text })
  });
  const data = await res.json();
  if (!data.ok) console.error(`Slack error: ${data.error}`);
  return data.ok;
}

function daysDiff(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(date);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
}

async function main() {
  console.log("Starting daily compute cleanup and reminders...");

  const records = await getAirtableRecords();
  const validPodNames = new Set();

  for (const record of records) {
    const f = record.fields;
    const approved = f["Approved"] === true;
    const expiry = f["Date of Expiry"] ? new Date(f["Date of Expiry"]) : null;
    const podName = f["Name of Pod"];
    const slackId = f["Slack Member ID"];

    if (!approved || !expiry || !podName) continue;

    const days = daysDiff(expiry);

    // Keep track of valid (approved + not yet expired) pods
    if (days >= 0) {
      validPodNames.add(podName.trim().toLowerCase());
    }

    // Send reminders
    if (slackId && (days === 3 || days === 1 || days === 0)) {
      let message;
      if (days === 3) {
        message = `⚠️ Reminder: Your compute pod *${podName}* expires in 3 days. If you need an extension, please submit another form and we'll try to review it on time!`;
      } else if (days === 1) {
        message = `🚨 Reminder: Your compute pod *${podName}* expires tomorrow! If you need an extension, please submit another form and we'll try to review it on time!`;
      } else if (days === 0) {
        message = `🔴 Your compute pod *${podName}* expires today! If you need an extension, please submit another form ASAP and we'll try to review it on time!`;
      }
      console.log(`Sending ${days}-day reminder to ${slackId} for pod ${podName}`);
      await sendSlackMessage(slackId, message);
    }
  }

  // Delete pods not in the valid list
  const runningPods = await getAllRunningPods();
  console.log(`Running pods: ${runningPods.map(p => p.name).join(", ") || "none"}`);

  for (const pod of runningPods) {
    const podName = (pod.name || "").trim().toLowerCase();
    if (!validPodNames.has(podName)) {
      console.log(`Deleting pod "${pod.name}" — not approved or expired`);
      const success = await deletePod(pod.id);
      if (success) {
        console.log(`✅ Deleted "${pod.name}"`);
        await sendSlackMessage(SLACK_CHANNEL_ID, `🗑️ Pod *${pod.name}* has been automatically deleted (expired or not approved).`);
      } else {
        console.log(`❌ Failed to delete "${pod.name}"`);
        await sendSlackMessage(SLACK_CHANNEL_ID, `❌ Failed to delete pod *${pod.name}* — please check manually.`);
      }
    } else {
      console.log(`✅ Keeping pod "${pod.name}"`);
    }
  }

  console.log("Done!");
}

main().catch(console.error);
