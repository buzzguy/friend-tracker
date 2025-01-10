import { setIcon } from "obsidian";
import type { ContactPageView } from "@/views/ContactPageView";
import type { Interaction } from "@/types";

export class InteractionView {
	constructor(private view: ContactPageView) {}

	render(container: HTMLElement, interactions: Interaction[]) {
		const interactionsList = container.createEl("div", {
			cls: "contact-interactions-list",
		});

		const sortedInteractions = [...interactions].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		);

		sortedInteractions.forEach((interaction, index) => {
			this.createInteractionItem(interactionsList, interaction, index);
		});
	}

	private createInteractionItem(
		container: HTMLElement,
		interaction: Interaction,
		index: number
	) {
		const interactionEl = container.createEl("div", {
			cls: "contact-interaction-item",
		});

		// Format date nicely, adjusting for timezone
		const [year, month, day] = interaction.date.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		const formattedDate = date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});

		// Date
		interactionEl.createEl("div", {
			cls: "contact-interaction-date",
			text: formattedDate,
		});

		// Text
		interactionEl.createEl("div", {
			cls: "contact-interaction-text",
			text: interaction.text,
		});

		// Actions
		const actions = interactionEl.createEl("div", {
			cls: "contact-interaction-actions",
		});

		// Edit button
		const editBtn = actions.createEl("button", {
			cls: "contact-interaction-edit",
			attr: { "aria-label": "Edit interaction" },
		});
		setIcon(editBtn, "pencil");
		editBtn.addEventListener("click", () => {
			this.view.openEditInteractionModal(index, interaction);
		});

		// Delete button
		const deleteBtn = actions.createEl("button", {
			cls: "contact-interaction-delete",
			attr: { "aria-label": "Delete interaction" },
		});
		setIcon(deleteBtn, "trash");
		deleteBtn.addEventListener("click", () => {
			this.view.deleteInteraction(index);
		});
	}
}
