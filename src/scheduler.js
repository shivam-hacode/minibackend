const cron = require('node-cron');
const { autoSubmitResult } = require('./autoSubmit');

let isRunning = false;

function scheduleJobOnQuarter(taskFunction) {
	const now = new Date();
	const minutes = now.getMinutes();
	const seconds = now.getSeconds();
	const ms = now.getMilliseconds();

	const remainder = minutes % 15;
	const delayMinutes = remainder === 0 ? 15 : 15 - remainder;

	const delayMs =
		delayMinutes * 60 * 1000 -
		(seconds * 1000 + ms);

	const nextRunTime = new Date(now.getTime() + delayMs);

	console.log(`Scheduler will start at ${nextRunTime.toLocaleTimeString()}`);

	setTimeout(async () => {
		await taskFunction();

		cron.schedule('*/15 * * * *', async () => {
			await taskFunction();
		});
	}, delayMs);
}

// ? Wrapper (IMPORTANT)
function startScheduler() {
	if (isRunning) {
		console.log("Scheduler already running ?");
		return;
	}

	isRunning = true;

	console.log("Scheduler started ?");

	scheduleJobOnQuarter(autoSubmitResult);
}

module.exports = startScheduler;
module.exports.startScheduler = startScheduler;