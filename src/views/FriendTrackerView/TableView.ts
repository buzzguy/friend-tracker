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
		headerContainer.createEl("h2", { text: "Friend tracker" });

		const addButton = headerContainer.createEl("button", {
			text: "Add contact",
			cls: "friend-tracker-add-button",
		});
		addButton.addEventListener("click", () =>
			this.view.openAddContactModal()
		);

		const content = container.createEl("div", {
			cls: "friend-tracker-content",
		});

		if (contacts.length === 0) {
			const emptyState = content.createEl("div", {
				cls: "friend-tracker-empty-state",
			});
			emptyState.createEl("p", {
				text: "No contacts found. Get started by creating your first contact!",
			});
			return;
		}

		// Create scrollable container for table
		const tableContainer = content.createEl("div", {
			cls: "friend-tracker-table-container",
		});

		// Create table for contacts
		const table = tableContainer.createEl("table", {
			cls: "friend-tracker-table",
		}) as HTMLTableElement;

		this.renderTableHeader(table, sort);
		this.renderTableRows(table, contacts);
	}

	private renderTableHeader(table: HTMLTableElement, sort: SortConfig) {
		const headerRow = table.createEl("tr") as HTMLTableRowElement;
		const columns: Array<{
			key: keyof Omit<ContactWithCountdown, "file"> | "actions";
			label: string;
			sortable?: boolean;
		}> = [
			{ key: "name", label: "Name", sortable: true },
			{ key: "age", label: "Age", sortable: true },
			{ key: "birthday", label: "Birthday", sortable: true },
			{ key: "daysUntilBirthday", label: "Days left", sortable: true },
			{ key: "relationship", label: "Type", sortable: true },
			{
				key: "lastInteraction",
				label: "Last interaction",
				sortable: true,
			},
			{ key: "actions", label: "", sortable: false },
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
					if (key !== "actions") {
						this.view.handleSort(
							key as keyof Omit<ContactWithCountdown, "file">
						);
					}
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
		const sortedContacts = this.sortContacts(
			contacts,
			this.view.currentSort
		);

		sortedContacts.forEach((contact) => {
			const row = table.createEl("tr") as HTMLTableRowElement;

			// Create name cell with click handler
			const nameCell = this.renderNameCell(contact);
			row.appendChild(nameCell); // Add the name cell to the row
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
			row.createEl("td", {
				text: contact.relationship || "N/A",
				cls: "friend-tracker-relationship-cell",
			});
			row.createEl("td", { text: contact.lastInteraction || "" });

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

	private renderNameCell(contact: ContactWithCountdown): HTMLElement {
		const cell = document.createElement("td");
		cell.className = "friend-tracker-name-cell";

		if (contact.daysUntilBirthday !== null) {
			if (contact.daysUntilBirthday === 0) {
				// Birthday today - show cake
				const indicator = cell.createEl("div", {
					cls: "table-birthday-indicator birthday-today",
					text: "🎂",
				});
			} else if (contact.daysUntilBirthday <= 7) {
				// Within a week - show green dot
				const dotContainer = cell.createEl("div", {
					cls: "table-birthday-status-dot",
				});
				dotContainer.createEl("div", {
					cls: "table-birthday-status-dot-inner",
				});
			}
		}

		cell.createSpan({ text: contact.name });

		return cell;
	}

	private sortContacts(contacts: ContactWithCountdown[], sort: SortConfig) {
		return [...contacts].sort((a, b) => {
			if (sort.column === "birthday") {
				// Extract month and day from birthday strings
				const dateA = new Date(a.birthday);
				const dateB = new Date(b.birthday);

				const aValue = (dateA.getMonth() + 1) * 100 + dateA.getDate();
				const bValue = (dateB.getMonth() + 1) * 100 + dateB.getDate();

				return sort.direction === "asc"
					? aValue - bValue
					: bValue - aValue;
			}

			// Add special handling for daysUntilBirthday
			if (sort.column === "daysUntilBirthday") {
				// Handle null values
				if (
					a.daysUntilBirthday === null &&
					b.daysUntilBirthday === null
				)
					return 0;
				if (a.daysUntilBirthday === null) return 1;
				if (b.daysUntilBirthday === null) return -1;

				// Normal numeric comparison that respects sort direction
				return (
					(a.daysUntilBirthday - b.daysUntilBirthday) *
					(sort.direction === "asc" ? 1 : -1)
				);
			}

			const aValue = a[sort.column];
			const bValue = b[sort.column];

			// Handle null/empty values in sorting
			if (!aValue && !bValue) return 0;
			if (!aValue) return 1;
			if (!bValue) return -1;

			// Sort direction
			const direction = sort.direction === "asc" ? 1 : -1;

			// Handle different types of values
			if (sort.column === "relationship" || sort.column === "name") {
				// Case-insensitive string comparison for text columns
				const aStr = String(aValue).toLowerCase();
				const bStr = String(bValue).toLowerCase();
				return aStr < bStr ? -direction : aStr > bStr ? direction : 0;
			} else if (
				typeof aValue === "number" &&
				typeof bValue === "number"
			) {
				// Numeric comparison
				return (aValue - bValue) * direction;
			}

			// Default string comparison
			return aValue < bValue
				? -direction
				: aValue > bValue
				? direction
				: 0;
		});
	}
}
