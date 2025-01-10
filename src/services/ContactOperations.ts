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
				contacts.push({
					name: metadata.name || "Unknown",
					birthday: metadata.birthday || "",
					formattedBirthday: this.formatBirthday(metadata.birthday),
					relationship: metadata.relationship || "",
					age: this.calculateAge(metadata.birthday),
					daysUntilBirthday: this.calculateDaysUntilBirthday(
						metadata.birthday
					),
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
		const birthDate = new Date(birthday);
		if (isNaN(birthDate.getTime())) return null;

		// Create this year's birthday
		const thisYearBirthday = new Date(
			today.getFullYear(),
			birthDate.getMonth(),
			birthDate.getDate()
		);

		// If this year's birthday has passed, use next year's birthday
		if (thisYearBirthday < today) {
			thisYearBirthday.setFullYear(today.getFullYear() + 1);
		}

		// Calculate days difference
		const diffTime = thisYearBirthday.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		return diffDays;
	}
}
