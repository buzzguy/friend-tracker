import { Notice, TFile } from "obsidian";
import type FriendTracker from "@/main";
import type { ContactWithCountdown } from "@/types";

export class ContactOperations {
	constructor(private plugin: FriendTracker) {}

	async getContacts(): Promise<ContactWithCountdown[]> {
		const folder = this.plugin.settings.contactsFolder;
		const vault = this.plugin.app.vault;
		const folderPath = vault.getFolderByPath(folder);

		if (!folderPath) {
			new Notice("Friend Tracker folder not found.");
			return [];
		}

		const files = folderPath.children.filter(
			(file) => file instanceof TFile
		);
		const contacts: ContactWithCountdown[] = [];

		for (const file of files) {
			if (!(file instanceof TFile)) continue;

			const metadata =
				this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

			if (metadata) {
				const lastInteraction =
					metadata.interactions?.length > 0
						? this.formatDaysAgo(metadata.interactions[0].date)
						: null;

				contacts.push({
					name: metadata.name || "Unknown",
					birthday: metadata.birthday || "",
					formattedBirthday: this.formatBirthday(metadata.birthday),
					relationship: metadata.relationship || "",
					age: this.calculateAge(metadata.birthday),
					daysUntilBirthday: this.calculateDaysUntilBirthday(
						metadata.birthday
					),
					lastInteraction,
					file,
				});
			}
		}

		return contacts;
	}

	private calculateAge(birthday: string): number | null {
		if (!birthday) return null;

		const birthDate = new Date(birthday);
		if (isNaN(birthDate.getTime())) return null;

		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDiff = today.getMonth() - birthDate.getMonth();

		if (
			monthDiff < 0 ||
			(monthDiff === 0 && today.getDate() < birthDate.getDate())
		) {
			age--;
		}

		return age;
	}

	private formatBirthday(dateStr: string): string {
		if (!dateStr) return "";

		const [year, month, day] = dateStr.split("-").map(Number);
		const date = new Date(year, month - 1, day); // months are 0-based

		if (isNaN(date.getTime())) return dateStr;

		return date.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
		});
	}

	private calculateDaysUntilBirthday(birthday: string): number | null {
		if (!birthday) return null;

		const today = new Date();
		// Use UTC methods to avoid timezone issues
		const birthDate = new Date(birthday + "T00:00:00Z");

		if (isNaN(birthDate.getTime())) return null;

		// Get today's date in UTC
		const todayUTC = new Date(
			Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
		);
		// Create this year's birthday in UTC
		const birthdayUTC = new Date(
			Date.UTC(
				today.getFullYear(),
				birthDate.getUTCMonth(),
				birthDate.getUTCDate()
			)
		);

		// If this year's birthday has already passed, use next year's birthday
		if (birthdayUTC < todayUTC) {
			birthdayUTC.setUTCFullYear(todayUTC.getUTCFullYear() + 1);
		}

		// Calculate days difference
		const diffTime = birthdayUTC.getTime() - todayUTC.getTime();
		return Math.round(diffTime / (1000 * 60 * 60 * 24)); // Round to avoid fractional days
	}

	private formatDaysAgo(dateStr: string): string {
		const date = new Date(dateStr);
		const today = new Date();
		const diffTime = today.getTime() - date.getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		return `${diffDays} days`;
	}

	public async getContactTypes() {
		const contacts = await this.getContacts();
		const relationships = contacts
			.map((contact) => contact.relationship)
			.filter((relationship) => relationship);

		// Create Set to remove duplicates
		return Array.from(new Set(relationships));
	}
}
