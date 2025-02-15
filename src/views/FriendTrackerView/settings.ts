import {
	App,
	PluginSettingTab,
	Setting,
	AbstractInputSuggest,
	TFolder,
} from "obsidian";
import type FriendTracker from "@/main";
import { normalizePath } from "obsidian";
import type { ContactWithCountdown } from "@/types";

class FolderSuggest extends AbstractInputSuggest<string> {
	inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): string[] {
		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f) => f instanceof TFolder)
			.map((f) => f.path);
		return folders.filter((f) =>
			f.toLowerCase().includes(inputStr.toLowerCase())
		);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.inputEl.value = value;
		this.inputEl.trigger("input");
		this.close();
	}
}

export class FriendTrackerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: FriendTracker) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const sortColumns: Array<{
			value: keyof Omit<ContactWithCountdown, "file">;
			label: string;
		}> = [
			{ value: "name", label: "Name" },
			{ value: "age", label: "Age" },
			{ value: "birthday", label: "Birthday" },
			{ value: "daysUntilBirthday", label: "Days until birthday" },
			{ value: "relationship", label: "Relationship" },
		];

		new Setting(containerEl)
			.setName("Contacts folder")
			.setDesc("Folder to store contact files")
			.addText((text) => {
				new FolderSuggest(this.app, text.inputEl);
				return text
					.setPlaceholder("Enter folder name")
					.setValue(this.plugin.settings.contactsFolder)
					.onChange(async (value) => {
						this.plugin.settings.contactsFolder =
							normalizePath(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Default sort")
			.setDesc("Choose how contacts are sorted by default")
			.addDropdown((dropdown) => {
				sortColumns.forEach(({ value, label }) => {
					dropdown.addOption(value, label);
				});
				return dropdown
					.setValue(this.plugin.settings.defaultSortColumn)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortColumn =
							value as keyof Omit<ContactWithCountdown, "file">;
						await this.plugin.saveSettings();
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("asc", "Ascending")
					.addOption("desc", "Descending")
					.setValue(this.plugin.settings.defaultSortDirection)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortDirection = value as
							| "asc"
							| "desc";
						await this.plugin.saveSettings();
					});
			});
	}
}
