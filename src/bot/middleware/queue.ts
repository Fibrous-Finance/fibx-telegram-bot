/** Per-user message queue ensuring serial processing */
export class MessageQueue {
	private queues = new Map<string, Promise<void>>();

	async enqueue(userId: string, handler: () => Promise<void>): Promise<void> {
		const previous = this.queues.get(userId) ?? Promise.resolve();
		const current = previous
			.then(() => handler())
			.catch(() => {
				/* errors handled upstream */
			})
			.finally(() => {
				// Clean up only if this is still the latest in the chain
				if (this.queues.get(userId) === current) {
					this.queues.delete(userId);
				}
			});
		this.queues.set(userId, current);
		await current;
	}
}
