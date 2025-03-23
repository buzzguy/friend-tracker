import { Plugin, Notice } from "obsidian";
import { FriendTrackerSettings, DEFAULT_SETTINGS } from "./types";
import {
	FriendTrackerView,
	VIEW_TYPE_FRIEND_TRACKER,
} from "./views/FriendTrackerView";
import {
	ContactPageView,
	VIEW_TYPE_CONTACT_PAGE,
} from "@/views/ContactPageView";
import { FriendTrackerSettingTab } from "./views/FriendTrackerView/settings";
import { ContactOperations } from "@/services/ContactOperations";

export default class FriendTracker extends Plugin {
	settings: FriendTrackerSettings;
	public contactOperations: ContactOperations;

	async onload() {
		await this.loadSettings();
		this.contactOperations = new ContactOperations(this);

		// On mobile, we should wait for layout-ready
		this.app.workspace.onLayoutReady(() => {
			this.initialize();
		});
	}

	private async initialize() {
		try {
			// Register views
			this.registerView(
				VIEW_TYPE_FRIEND_TRACKER,
				(leaf) => new FriendTrackerView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_CONTACT_PAGE,
				(leaf) => new ContactPageView(leaf, this)
			);

			// Add ribbon icon
			this.addRibbonIcon("user", "Open friend tracker", async () => {
				const workspace = this.app.workspace;
				const leaves = workspace.getLeavesOfType(
					VIEW_TYPE_FRIEND_TRACKER
				);

				// Check for existing view, handling deferred views
				for (const leaf of leaves) {
					const view = await leaf.view;
					if (view instanceof FriendTrackerView) {
						workspace.revealLeaf(leaf);
						return;
					}
				}

				const leaf = workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_FRIEND_TRACKER,
						active: true,
					});
					workspace.revealLeaf(leaf);
				} else {
					new Notice("Could not create Friend Tracker view");
				}
			});

			// Add settings tab
			this.addSettingTab(new FriendTrackerSettingTab(this.app, this));
		} catch (error) {
			console.error("Friend Tracker failed to load:", error);
			new Notice("Friend Tracker failed to load: " + error.message);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
