# User Manual — OrderMailing Platform

> **Welcome!**
> This manual covers every part of the platform step by step.
> You do not need any technical knowledge. If you can click a mouse, you can use this application.

---

## Table of Contents

1. Logging In & Registering
2. Navigation
3. Orders
4. New Order
5. Suppliers
6. Design Editor
7. Video Creator
8. Automaten (Vending Machines)
9. Users
10. Settings
11. Keyboard Shortcuts Reference
12. Tips & Tricks

---

## 1. Logging In & Registering

### Logging in

1. Open the application in your browser.
2. You will see a login page asking for your **email address** and **password**.
3. Enter your details and click **Sign in**.

### Registering a new account

New accounts are created by invitation only (see **Section 9 – Users** below).
If you have received an invite link, click it and follow the on-screen steps to set a password.

### Forgot your password?

Use the "Forgot password?" link on the login page. A reset email will be sent to your address.

---

## 2. Navigation

After logging in, a sidebar on the left side of the screen shows all the main sections:

| Menu item         | What it does                                  |
| ----------------- | --------------------------------------------- |
| **Orders**        | View and manage all orders                    |
| **Suppliers**     | Manage suppliers and their products           |
| **Design Editor** | Create visual designs (labels, posters, etc.) |
| **Video Creator** | Build slideshow / video projects              |
| **Automaten**     | Check vending machine stock in real time      |
| **Users**         | Invite and manage team members (admins only)  |
| **Settings**      | Import supplier data                          |

Click any item to go to that section.

---

## 3. Orders

This page shows **all orders** placed through the platform.

### Viewing orders

- On the **mobile** view, orders appear as scrollable cards.
- On **desktop**, orders appear in a paginated table with columns for Supplier, Status, Items, Created by, and Date.

### Order statuses

| Status    | Meaning                  |
| --------- | ------------------------ |
| **Draft** | Started but not yet sent |
| **Sent**  | Sent to the supplier     |

### Filtering orders

Use the filter buttons at the top of the page to show only orders with a specific status (All, Draft, Sent, etc.).

### Editing a draft order

Click the **pencil icon** next to a draft order to continue editing it.

### Deleting an order

Click the **bin icon** next to any order and confirm the deletion in the dialog that appears.

---

## 4. New Order

### Step 1 — Pick a supplier

1. Click **New order** (top-right of the Orders page).
2. A grid of all active suppliers appears.
3. Use the **search box** to filter by name.
4. Click the supplier you want to order from.

### Step 2 — Fill in quantities

1. A list of all the supplier's products appears.
2. Each product shows its name, the supplier's own name for it (if different), and the **ideal stock** level.
3. Use the **− and + buttons** to set the quantity for each product you want to order.
   - You can also type a number directly into the quantity field.
   - Tap the − button all the way to 0 to remove a product from the order.
4. The header shows a live item count and a save indicator (cloud icon = saved, hard-drive icon = saved locally).

### Step 3 — Review & send

1. Click **Review order** (top-right) when you are happy with the quantities.
2. A summary table shows every product and quantity.
3. Click **Send order** to send the order to the supplier by email.
4. A green "Order sent!" confirmation will appear.

### Leaving a draft order

If you navigate away while filling in an order, a dialog asks what you want to do:

- **Save & leave** — saves the order as a draft so you can continue later.
- **Cancel & leave** — discards the current order.
- **Continue ordering** — stays on the current order.

> **Tip:** Orders are saved automatically every few seconds while you work.

---

## 5. Suppliers

This page lets you manage all your suppliers and the products you can order from each one.

### Adding a supplier

1. Click **Add supplier** (top-right).
2. Fill in the supplier's **name**, **email address**, optional **description**, and set whether they are **active**.
3. Click **Save**.

### Editing a supplier

1. Find the supplier in the list (use the **search bar** to filter by name).
2. Click the **pencil icon** to open the edit form.
3. Change the details and click **Save**.

### Activating / deactivating a supplier

Edit the supplier and toggle the **Active** switch. Inactive suppliers do not appear when creating new orders.

### Deleting a supplier

Click the **bin icon** next to the supplier and confirm the deletion.

> ⚠️ Deleting a supplier removes all their products too.

### Managing products

1. Click the **Products** button (or the product count chip) on any supplier row.
2. A side panel opens showing all the supplier's products.
3. From here you can:
   - **Add a product** — click the + button and fill in the product form.
   - **Edit a product** — click the pencil icon on the product row.
   - **Delete a product** — click the bin icon and confirm.

### Product fields

| Field             | Description                                       |
| ----------------- | ------------------------------------------------- |
| **Internal name** | The name your team uses internally                |
| **Supplier name** | The name the supplier uses (may differ)           |
| **Ideal stock**   | The target level — shown during order entry       |
| **Manual order**  | Marks the product with a yellow "Handmatig" badge |
| **Active**        | Only active products appear when ordering         |

### Sorting the supplier table

Click the **Name**, **Status**, or **Products** column headers to sort the list. Click again to reverse the order.

---

## 6. Design Editor

The Design Editor lets you create visual designs — labels, posters, order sheets — and export them as PNG or JPG images.

### 6.1 Opening / creating a project

1. Go to **Design Editor** in the sidebar.
2. Click **New project**, enter a name and (optionally) choose a size, then click **Create**.
3. Click **Open** on an existing project card to start editing it.
4. From the project card menu (⋯) you can **Rename** or **Delete** a project.

---

### 6.2 The editor layout

When a project is open, the screen is divided into four areas:

- **Top toolbar** — tools, undo/redo, zoom, font menu, export
- **Left panel** — layer list and quick-add buttons
- **Centre** — the artboard (your design canvas)
- **Right panel** — properties for the selected element

---

### 6.3 The artboard

The artboard is the white (or coloured) rectangle in the centre — this is your design canvas.

- Default size: **1920 × 1080 px**.
- Change the width, height, and background colour in the **Properties panel** on the right (when nothing is selected, artboard settings are shown).

---

### 6.4 Tools (top toolbar)

| Tool          | Shortcut | How to use                                                                  |
| ------------- | -------- | --------------------------------------------------------------------------- |
| **Select**    | `V`      | Click an element to select it. Drag on empty space to draw a selection box. |
| **Rectangle** | `R`      | Click and drag on the artboard to draw a rectangle.                         |
| **Ellipse**   | `E`      | Click and drag to draw a circle or oval.                                    |
| **Text**      | `T`      | Click and drag to place a new text box.                                     |
| **Image**     | `I`      | Opens a file picker — choose a photo or graphic from your computer.         |
| **Pan**       | `H`      | Click and drag to scroll the artboard without selecting anything.           |

After drawing a rectangle, ellipse, or text box, the editor automatically switches back to the Select tool.

---

### 6.5 Adding elements

**Method A — Draw on the canvas:**

1. Click a tool in the toolbar (or press its keyboard shortcut).
2. Click and drag on the artboard to set the size.

**Method B — Quick-add buttons (bottom of the Layers panel):**
Click Rectangle, Ellipse, Text, or Image to add a default-sized element instantly.

---

### 6.6 Selecting elements

| Action                                 | Result                                                                |
| -------------------------------------- | --------------------------------------------------------------------- |
| Click an element                       | Select it                                                             |
| Hold **Shift** + click another element | Add it to the selection                                               |
| **Drag** on empty artboard space       | Draw a selection box — all elements that overlap the box get selected |
| Press **Escape**                       | Clear all selections                                                  |

When multiple elements are selected, a **dashed blue bounding box** appears around the entire group.

---

### 6.7 Moving elements

- Click and drag a selected element to move it freely.
- When multiple elements are selected, drag **anywhere on the dashed bounding box** to move the entire group together.

---

### 6.8 Resizing elements

1. Select an element — eight **white square handles** appear around it.
2. Drag any handle to resize:
   - **Corner handles** — resize width and height together.
   - **Edge handles** — resize in one direction only.
3. Modifier keys (hold while dragging):
   - **Shift** — keep the original proportions (aspect ratio lock). Works on corner handles.
   - **Alt** — resize from the centre: both opposite sides grow/shrink equally.
   - **Shift + Alt** together — proportional resize from the centre.

These same modifier keys work when resizing a **multi-element selection**.

---

### 6.9 Layers panel (left)

- Every element on the artboard is listed as a **layer**.
- The layer at the **top of the list** appears in **front** on the canvas; the bottom layer is in the back.
- Click a layer name to select it.
- **Hover** over a layer to reveal the **× delete button**.
- Use the **Order** buttons in the Properties panel (⬆ ⬇) to move a selected layer forward or backward.

---

### 6.10 Properties panel (right)

When an element is selected its editable properties appear here:

**Transform (all elements)**

- **X / Y** — position in pixels from the top-left of the artboard.
- **W / H** — width and height in pixels.
- **Opacity** — transparency slider (0 = invisible, 1 = fully visible).
- **Name** — rename the layer.

**Text elements** (extra options)

- **Size** — font size in pixels.
- **Weight** — Normal or Bold.
- **Color** — click the colour swatch to open a colour picker.
- **Align** — left, centre, or right.
- **Font** — click the font button to choose from a list of fonts. Each font is shown in its own typeface so you can preview it. Includes the built-in **MyriadPro Black** and popular Google Fonts (Roboto, Open Sans, Montserrat, Lato, etc.).
- **Auto size** toggle — when on, the text box automatically resizes to fit the text content exactly.
- **Double-click** a text element directly on the canvas to edit the text in place.

**Image elements** (extra options)

- **Choose image / Replace** — upload a new photo or graphic.
- **Object fit** — _Contain_ (the whole image fits inside the box) or _Cover_ (the image fills the box, cropping the edges if needed).
- **Remove Background** — automatically removes the background from the photo using AI. The result shows the subject with a transparent background.

---

### 6.11 Text ▾ menu (toolbar)

The **Text ▾** button in the top toolbar opens a dropdown with two power options:

1. **Font – all layers** — choose a font and it applies to every text layer on the artboard at once.
2. **Auto-size all text** — resizes every text layer automatically so no text is hidden. Shortcut: `Ctrl+Shift+A`.

---

### 6.12 Importing an SVG file

1. Click **Import SVG** in the toolbar.
2. Choose an `.svg` file from your computer.
3. The SVG is broken down into individual design elements — each shape can then be selected and edited separately.

---

### 6.13 Undo & Redo

| Action                 | Shortcut | Button       |
| ---------------------- | -------- | ------------ |
| Undo the last change   | `Ctrl+Z` | ↩ in toolbar |
| Redo the undone change | `Ctrl+Y` | ↪ in toolbar |

Up to **80 steps** of history are kept.

---

### 6.14 Zoom & Pan

| Action                 | How                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Zoom in / out          | `Ctrl + Scroll wheel` or the **+** / **−** buttons                                          |
| Fit artboard to screen | Click the ⊠ button                                                                          |
| Pan (scroll canvas)    | Press `H` to activate Pan tool, then click-drag. Or scroll with the mouse wheel / trackpad. |

---

### 6.15 Exporting your design

1. Choose a format — **PNG** or **JPG** — from the dropdown in the top-right of the toolbar.
2. Click **Export**.
3. The image is downloaded to your computer automatically.

---

### 6.16 Auto-save

Your design is **saved automatically** to your browser's local storage a few seconds after any change. You never need to press a Save button.

---

## 7. Video Creator

The Video Creator lets you build a slideshow of fullscreen images (screens) that can be exported as a video.

### 7.1 Opening / creating a project

1. Go to **Video Creator** in the sidebar.
2. Click **New project**, give it a name, and click **Create**.
3. Click **Open** on any existing project to edit it.

---

### 7.2 The video editor layout

- **Left panel** — screen list with thumbnails and drag handles
- **Centre** — canvas preview (drop images here)
- **Right panel** — properties for the selected screen

---

### 7.3 Adding screens

1. Click **Add screen** at the bottom of the screen list.
2. A new blank screen is added to the end of the list.
3. Select it to start editing it in the canvas area.

---

### 7.4 Adding an image to a screen

**Method A — Drag and drop:**
Drag an image file from your computer and drop it onto the canvas area.

**Method B — Click to upload:**
With a screen selected, click the canvas area (or the upload button in the Properties panel) and choose a file.

---

### 7.5 Screen properties (right panel)

- **Name** — rename the screen.
- **Duration** — how many seconds this screen shows in the exported video.
- **Resolution** — the display resolution (e.g. 1920 × 1080).
- **Fit** — _Contain_ (whole image visible, may have black bars) or _Cover_ (fills the screen, may crop edges).
- **Offset X / Y** — fine-tune the position of a Cover image.

---

### 7.6 Reordering screens

Drag the **grip handle** (⋮⋮ icon, top-right of a screen card) up or down in the list to change the screen order.

---

### 7.7 Removing a screen

Click the **× button** in the bottom-right of the screen card in the left list.

---

### 7.8 Exporting the video

1. Click the **Export** button (top-right of the editor).
2. Choose your export settings in the dialog that opens.
3. Click **Export** to start rendering and download the result.

---

## 8. Automaten (Vending Machines)

This page shows the **real-time stock levels** of your physical vending machines.

> This section is displayed in Dutch because it is used by Dutch-speaking operators.

### Checking machine stock

1. Go to **Automaten** in the sidebar.
2. Click the button for the machine you want to check (e.g. _De Mol, De Brug_).
3. Wait up to 30 seconds while the system fetches the live data.
4. The results show a summary of:
   - **Leeg** (Empty) — slots with no stock.
   - **Laag** (Low) — slots with low stock.
   - **OK** — slots with sufficient stock.

### Filtering results

Use the filter tabs (**All / Empty / Low / OK**) to focus on a specific stock status.

### Reading the table

Each row shows a product slot with its name, current quantity, and a colour-coded status badge (red = empty, orange = low, green = ok).

### Refreshing

Click the machine button again to fetch fresh data.

---

## 9. Users

This page lets administrators manage who has access to the platform.

### Viewing users

The user table shows the **Name**, **Email**, **Role** (admin or user), and the date they were added.

### Inviting a new user

1. Click **Add user** (top-right).
2. A unique **invite link** is generated automatically.
3. Copy the link and send it to the person you want to invite. They click the link to set up their account.

### Changing a user's role

1. In the **Role** column, click the role badge for any user (except yourself).
2. A dropdown appears — choose **admin** or **user**.

| Role      | Can do                                            |
| --------- | ------------------------------------------------- |
| **admin** | Everything, including managing users and settings |
| **user**  | Orders, design, video, vending machine view       |

### Removing a user

Click the **bin icon** on the user's row, then confirm.

> You cannot delete your own account.

---

## 10. Settings

### Importing supplier data from a JSON file

Use this if you have a pre-prepared list of suppliers and products that you want to load all at once.

> ⚠️ **Warning:** Importing overwrites all existing supplier data. This cannot be undone.

1. Go to **Settings** in the sidebar.
2. Click or drag a **JSON file** onto the upload area.
3. The platform previews the contents — you can see how many suppliers and products were found.
4. Click **Import**.
5. A confirmation dialog warns you that existing data will be overwritten. Click **Import** again to confirm.
6. A green success message confirms how many suppliers and products were imported.

### JSON file format

The JSON file must contain a `suppliers` array. Each supplier entry should include:

- `name` — supplier name
- `email` — contact email
- `products` — array of product objects

If you are unsure about the format, ask your administrator for an example file.

---

## 11. Keyboard Shortcuts Reference

### Global

| Shortcut | Action |
| -------- | ------ |
| `Ctrl+Z` | Undo   |
| `Ctrl+Y` | Redo   |

### Design Editor — Tools

| Key | Tool      |
| --- | --------- |
| `V` | Select    |
| `R` | Rectangle |
| `E` | Ellipse   |
| `T` | Text      |
| `I` | Image     |
| `H` | Pan       |

### Design Editor — Actions

| Shortcut                     | Action                            |
| ---------------------------- | --------------------------------- |
| `Delete` / `Backspace`       | Delete selected element(s)        |
| `Escape`                     | Clear selection                   |
| `Ctrl+Shift+A`               | Auto-size all text layers         |
| `Shift` + drag resize handle | Keep aspect ratio while resizing  |
| `Alt` + drag resize handle   | Resize from the centre            |
| `Shift+Alt` + drag           | Aspect ratio + from centre        |
| `Shift` + click element      | Add / remove from multi-selection |

---

## 12. Tips & Tricks

1. **Use keyboard shortcuts.** Pressing `V`, `R`, `T` etc. is much faster than clicking the toolbar every time.

2. **Drag a selection box first.** Instead of clicking elements one by one, switch to the Select tool (`V`), then drag a box around a group of elements to select them all at once.

3. **Hold Shift when resizing text boxes.** This ensures your logo or badge stays perfectly square or proportional after editing.

4. **Use "Auto-size" for text layers.** Enable it per layer or press `Ctrl+Shift+A` for all layers at once — this means text will never be hidden or clipped when you update the content.

5. **Set fonts for all layers at once.** Use the **Text ▾ → Font – all layers** menu to apply a single font across the whole design in one click, saving you from editing each text layer individually.

6. **Remove backgrounds quickly.** Upload an image in the Design Editor, then click **Remove Background** in the Properties panel. The AI handles it automatically — no external tools needed.

7. **Import SVG files as editable elements.** If a colleague or designer gives you an SVG file, you can import it directly into the Design Editor. Each shape in the SVG becomes its own editable layer.

8. **Save drafts when ordering.** If you need to step away while filling in a product order, navigate away and choose **Save & leave**. Your draft will be waiting for you when you come back.

9. **Zoom in for precise work.** Hold `Ctrl` and scroll up to zoom in for pixel-perfect positioning. Use the ⊠ button to jump back to a full-artboard view at any time.

10. **Use the Automaten page before creating an order.** Check the machine stock first so you know exactly what needs replenishing — then create the order with the right quantities straight away.

---

_End of manual._
