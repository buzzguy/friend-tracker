import { setIcon } from "obsidian";
import type { FriendTrackerView } from "./index";
import type { ContactWithCountdown, SortConfig } from "@/types";

export class TableView {
	constructor(private view: FriendTrackerView) {}

	async render(
		container: HTMLElement,
		contacts: ContactWithCountdown[],
		sort: SortConfig
	) {
		// Create header and add contact button container
		const headerContainer = container.createEl("div", {
			cls: "friend-tracker-header",
		});
		headerContainer.createEl("h2", { text: "Friend Tracker" });

		const addButton = headerContainer.createEl("button", {
			text: "Add contact",
			cls: "friend-tracker-add-button",
		});
		addButton.addEventListener("click", () =>
			this.view.openAddContactModal()
		);

		if (contacts.length === 0) {
			const emptyState = container.createEl("div", {
				cls: "friend-tracker-empty-state",
			});
			emptyState.createEl("p", {
				text: "No contacts found. Get started by creating your first contact!",
			});
			return;
		}

		// Create table for contacts
		const table = container.createEl("table", {
			cls: "friend-tracker-table",
		}) as HTMLTableElement;

		this.renderTableHeader(table, sort);
		this.renderTableRows(table, contacts);
	}

	private renderTableHeader(table: HTMLTableElement, sort: SortConfig) {
		const headerRow = table.createEl("tr") as HTMLTableRowElement;
		const columns: Array<{
			key: keyof Omit<ContactWithCountdown, "file">;
			label: string;
			sortable?: boolean;
		}> = [
			{ key: "name", label: "Name", sortable: true },
			{ key: "age", label: "Age", sortable: true },
			{ key: "formattedBirthday", label: "Birthday", sortable: true },
			{ key: "daysUntilBirthday", label: "Days left", sortable: true },
			{ key: "relationship", label: "Type", sortable: true },
			{ key: "name", label: "", sortable: false },
		];

		columns.forEach(({ key, label, sortable }) => {
			const th = headerRow.createEl("th");

			if (sortable) {
				const button = th.createEl("button", {
					cls: "friend-tracker-sort-button",
				});

				// Add text span
				button.createEl("span", { text: label });

				// Add sort indicator span
				button.createEl("span", {
					cls: "sort-indicator",
					text:
						sort.column === key
							? sort.direction === "asc"
								? "↑"
								: "↓"
							: "",
				});

				button.addEventListener("click", () => {
					this.view.handleSort(key);
				});
			} else {
				th.setText(label);
			}
		});
	}

	private renderTableRows(
		table: HTMLTableElement,
		contacts: ContactWithCountdown[]
	) {
		// Sort contacts based on current sort configuration
		const sortedContacts = [...contacts].sort((a, b) => {
			const aValue = a[this.view.currentSort.column];
			const bValue = b[this.view.currentSort.column];

			// Handle null/undefined values
			if (aValue == null) return 1;
			if (bValue == null) return -1;

			// Compare values
			const direction =
				this.view.currentSort.direction === "asc" ? 1 : -1;
			if (typeof aValue === "number" && typeof bValue === "number") {
				return (aValue - bValue) * direction;
			}
			return String(aValue).localeCompare(String(bValue)) * direction;
		});

		sortedContacts.forEach((contact) => {
			const row = table.createEl("tr") as HTMLTableRowElement;

			// Create name cell with click handler
			const nameCell = row.createEl("td", {
				cls: "friend-tracker-name-cell",
				text: contact.name,
			});
			nameCell.addEventListener("click", (e) => {
				e.stopPropagation(); // Stop event from bubbling
				this.view.openContact(contact.file);
			});

			// Rest of the cells (no click handlers)
			row.createEl("td", { text: contact.age?.toString() || "N/A" });
			row.createEl("td", {
				text: contact.formattedBirthday || "N/A",
			});
			row.createEl("td", {
				text:
					contact.daysUntilBirthday !== null
						? `${contact.daysUntilBirthday} days`
						: "N/A",
			});
			row.createEl("td", { text: contact.relationship || "N/A" });

			// Actions cell
			const actionsCell = row.createEl("td", {
				cls: "friend-tracker-actions",
			});

			// Delete button
			const deleteButton = actionsCell.createEl("button", {
				cls: "friend-tracker-delete-button",
				attr: { "aria-label": "Remove contact" },
			});
			setIcon(deleteButton, "trash");

			deleteButton.addEventListener("click", (e) => {
				e.stopPropagation();
				this.view.openDeleteModal(contact.file);
			});
		});
	}
}
