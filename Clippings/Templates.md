[Web Clipper](https://help.obsidian.md/web-clipper) allows you to create templates that automatically capture and organize metadata from web pages. Example templates are available in the [clipper-templates repo](https://github.com/kepano/clipper-templates).

## Create or edit a template

To **create** a template go to Web Clipper settings and click the **New template** button in the sidebar. You can also **duplicate** a template in the **More** actions menu in the top right corner.

Templates make use of [Variables](https://help.obsidian.md/web-clipper/variables) and [Filters](https://help.obsidian.md/web-clipper/filters), which allow you to tailor how content will be saved.

## Import and export Web Clipper templates

To import a template:

1. Open the extension and click the **Settings** cog icon.
2. Go to any template in the list.
3. Click **Import** in the top right or drag and drop your `.json` template file(s) anywhere in the template area.

To export a template click **Export** in the top right. This will download the template `.json` file. You can also copy the template data to your clipboard via the **More** menu.

## Template settings

### Behavior

Define how content from Web Clipper will be added to Obsidian:

- **Create a new note**
- **Add to an existing note**, at the top or bottom
- **Add to daily note**, at the top or bottom (requires the [daily notes](https://help.obsidian.md/plugins/daily-notes) plugin to be active)

### Automatically trigger a template

Template triggers allow you to automatically select a template based on the current page URL or [schema.org](https://schema.org/) data. You can define multiple rules for each template, separated by a new line.

The first match in your template list determines which template is used. You can drag templates up and down in Web Clipper settings to change the order in which templates are matched.

#### Simple URL matching

Simple matching triggers a template if the current page URL *starts with* the given pattern. For example:

- `https://obsidian.md` will match any URL that starts with this text.

#### Regular expression matching

You can trigger templates based on more complex URL patterns using regular expressions. Enclose your regex pattern in forward slashes (`/`). Remember to escape special characters in regex patterns (like `.` and `/`) with a backslash (`\`). For example:

- `/^https:\/\/www\.imdb\.com\/title\/tt\d+\/reference\/?$/` will match any IMDB reference page.

#### Schema.org matching

You can trigger templates based on [schema.org](https://schema.org/) data present on the page. Use the `schema:` prefix followed by the schema key you want to match. You can optionally specify an expected value. For example:

Schema.org values can also be used to [pre-populate data in templates](https://help.obsidian.md/web-clipper/variables#Schema.org%20variables).

### Interpreter context

When [Interpreter](https://help.obsidian.md/web-clipper/interpreter) is enabled, you can use [prompt variables](https://help.obsidian.md/web-clipper/variables#Prompt%20variables) to extract page content with natural language. For each template you can define the [context](https://help.obsidian.md/web-clipper/interpreter#Context) that Interpreter has access too.