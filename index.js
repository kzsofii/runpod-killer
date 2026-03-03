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
  const slackIdByPodName = {}; // store for ALL approved pods, including expired

  for (const record of records) {
    const f = record.fields;
    const approved = f["Approved"] === true;
    const expiry = f["Date of Expiry"] ? new Date(f["Date of Expiry"]) : null;
    const podName = f["Name of Pod"];
    const slackId = f["Slack Member ID"];

    if (!approved || !expiry || !podName) continue;

    const days = daysDiff(expiry);
    const key = podName.trim().toLowerCase();

    // Store Slack ID for all approved pods (even expired) so we can DM on deletion
    if (slackId) slackIdByPodName[key] = slackId;

    // Only keep unexpired pods alive
    if (days >= 0) {
      validPodNames.add(key);
    }

    // Send reminders
    if (slackId && days === 2) {
      await sendSlackMessage(slackId,
        `Hello! Just a heads up — your pod ${podName} expires in 3 days at midnight. In case you need an extension, submit another compute request form with the same pod name and we'll try to review it on time. Hope you're having fun working on your project!🦾 If you've already stopped working on it and killed your pod, feel free to disregard this message.`
      );
      console.log(`Sent 3-day reminder to ${slackId} for pod ${podName}`);
    }

    if (slackId && days === 0) {
      await sendSlackMessage(slackId,
        `Hello! Your pod ${podName} expires tonight at midnight. Make sure to finish up by then because your pod will be deleted. In case you need an extension, submit another compute request form with the same pod name and we'll try to review it on time. Good luck with your work!👩🏻‍💻 If you've already stopped working on it and killed your pod, feel free to disregard this message.`
      );
      console.log(`Sent 1-day reminder to ${slackId} for pod ${podName}`);
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
        const slackId = slackIdByPodName[podName];
        if (slackId) {
          await sendSlackMessage(slackId,
            `Hey! Just letting you know that your pod ${pod.name} has been deleted as scheduled. Thanks for doing projects with us — hope it was constructive and successful! 🎉`
          );
        }
        await sendSlackMessage(SLACK_CHANNEL_ID, `Pod *${pod.name}* has been automatically deleted.`);
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
