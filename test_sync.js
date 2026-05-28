const { syncICICIEmails } = require('./src/app/actions/bankSync');

async function test() {
  console.log("Triggering manual sync...");
  try {
    await syncICICIEmails('cmpohn1qx000hs668bsklsjdh');
    console.log("Finished manual sync.");
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
