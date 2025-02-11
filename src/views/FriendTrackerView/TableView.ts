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

		// Create Search Bar
		const searchBar = headerContainer.createEl("input", {
			text: "Search",
			cls: "contact-field-input",
			attr: {
				type: "text",
				placeholder: "Search",
				value: this.view.searchText
			}
		});

		this.view.searchBarEl = searchBar;

		searchBar.addEventListener("input", () => {
			this.view.handleSearch(searchBar.value || "");
		});

		// Create Relationship Dropdown
		const relationshipDropDown = headerContainer.createEl("select");

		const contactTypes = (await this.view.getContactTypesList()) ?? []
		const contactItems = contactTypes.map(type => ({text: type, value: type}))

		contactItems.unshift({text: "No Relationship Filter", value: "index"})

		contactItems.forEach(({ text, value }) => {
			relationshipDropDown.appendChild(new Option(text, value));
		});

		relationshipDropDown.value = this.view.relationshipFilter;

		relationshipDropDown.addEventListener("change", () => {
			this.view.handleFilterRelationship(relationshipDropDown.value);
		});

		// Create Add Contact Button
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
			{ key: "birthday", label: "Birthday", sortable: true },
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
		const sortedContacts = this.sortContacts(
			contacts,
			this.view.currentSort
		);

		// Filter
		const filteredContacts = this.filterContacts(
			sortedContacts,
			this.view.searchText,
			this.view.relationshipFilter
		);

		filteredContacts.forEach((contact) => {
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

	private filterContacts(contacts: ContactWithCountdown[], searchText: string, relationshipFilter: string) {
		// Apply Filters
		return contacts
			.filter(this.searchFilter(searchText))
			.filter(this.relationshipFilter(relationshipFilter));
	}

	// Filter function Factories
	private searchFilter = (searchText: string) => {
		return (contact: ContactWithCountdown) => contact.name.contains(searchText);
	}

	private relationshipFilter = (relationship: string) => {
		return (contact: ContactWithCountdown) => {
			if(relationship === "index") return true
			return contact.relationship === relationship
		};
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

			// Existing sorting logic for other columns
			const aValue = a[sort.column];
			const bValue = b[sort.column];

			if (typeof aValue === "string" && typeof bValue === "string") {
				return sort.direction === "asc"
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue);
			}

			return sort.direction === "asc"
				? (aValue as number) - (bValue as number)
				: (bValue as number) - (aValue as number);
		});
	}
}
