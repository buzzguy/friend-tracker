import { Notice, TFile, parseYaml } from "obsidian";
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

			try {
				// Read the file content directly instead of relying on metadata cache
				const content = await vault.read(file);
				const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);

				if (yamlMatch) {
					const metadata = parseYaml(yamlMatch[1]);

					const lastInteraction =
						metadata.interactions?.length > 0
							? this.formatDaysAgo(metadata.interactions[0].date)
							: null;

					contacts.push({
						name: metadata.name || "Unknown",
						birthday: metadata.birthday || "",
						formattedBirthday: this.formatBirthday(
							metadata.birthday
						),
						relationship: metadata.relationship || "",
						age: this.calculateAge(metadata.birthday),
						daysUntilBirthday: this.calculateDaysUntilBirthday(
							metadata.birthday
						),
						lastInteraction,
						file,
					});
				}
			} catch (error) {
				console.error(
					`Error reading contact file ${file.path}:`,
					error
				);
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

	public calculateDetailedAge(birthday: string): string {
		if (!birthday) return "";

		// Parse the birthday and set it to local midnight
		const [birthYear, birthMonth, birthDay] = birthday
			.split("-")
			.map(Number);
		const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
		birthDate.setHours(0, 0, 0, 0);

		if (isNaN(birthDate.getTime())) return "";

		// Get today at local midnight
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		let years = today.getFullYear() - birthDate.getFullYear();
		let months = today.getMonth() - birthDate.getMonth();
		let days = today.getDate() - birthDate.getDate();

		// Adjust for negative days
		if (days < 0) {
			months--;
			// Get last day of previous month
			const lastMonth = new Date(
				today.getFullYear(),
				today.getMonth(),
				0
			);
			days += lastMonth.getDate();
		}

		// Adjust for negative months
		if (months < 0) {
			years--;
			months += 12;
		}

		// Format the output
		const parts = [];

		if (years > 0) {
			parts.push(`${years} ${years === 1 ? "year" : "years"}`);
		}

		if (months > 0) {
			parts.push(`${months} ${months === 1 ? "month" : "months"}`);
		}

		if (days > 0) {
			parts.push(`${days} ${days === 1 ? "day" : "days"}`);
		}

		return parts.join(", ") + " old";
	}

	private formatBirthday(dateStr: string): string {
		if (!dateStr) return "";

		// Parse the birthday and set it to local midnight
		const [birthYear, birthMonth, birthDay] = dateStr
			.split("-")
			.map(Number);
		const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
		birthDate.setHours(0, 0, 0, 0);

		if (isNaN(birthDate.getTime())) return dateStr;

		return birthDate.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
		});
	}

	public calculateDaysUntilBirthday(birthday: string): number | null {
		if (!birthday) return null;

		// Parse the birthday and set it to local midnight
		const [birthYear, birthMonth, birthDay] = birthday
			.split("-")
			.map(Number);
		const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
		birthDate.setHours(0, 0, 0, 0);

		if (isNaN(birthDate.getTime())) return null;

		// Get today at local midnight
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Create this year's birthday at local midnight
		const thisYearBirthday = new Date(
			today.getFullYear(),
			birthDate.getMonth(),
			birthDate.getDate()
		);
		thisYearBirthday.setHours(0, 0, 0, 0);

		// If this year's birthday has already passed, use next year's birthday
		if (thisYearBirthday < today) {
			thisYearBirthday.setFullYear(today.getFullYear() + 1);
		}

		// Calculate days difference
		const diffTime = thisYearBirthday.getTime() - today.getTime();
		return Math.round(diffTime / (1000 * 60 * 60 * 24));
	}

	private formatDaysAgo(dateStr: string): string {
		const date = new Date(dateStr);
		const today = new Date();
		const diffTime = today.getTime() - date.getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		return `${diffDays} days`;
	}
}
