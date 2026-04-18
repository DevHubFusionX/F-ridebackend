import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Templates directory path
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'emails');

// Cache for compiled templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

// Initialize and register the base layout
let layoutCompiled: HandlebarsTemplateDelegate | null = null;

const getLayout = () => {
    if (layoutCompiled) return layoutCompiled;
    
    const layoutPath = path.join(TEMPLATES_DIR, 'layout.hbs');
    if (fs.existsSync(layoutPath)) {
        const layoutSource = fs.readFileSync(layoutPath, 'utf8');
        layoutCompiled = Handlebars.compile(layoutSource);
    } else {
        // Fallback simple layout just in case
        layoutCompiled = Handlebars.compile('{{{body}}}');
    }
    return layoutCompiled;
};

/**
 * Loads a template, compiles it, and caches it.
 * @param templateName The name of the template file without `.hbs`
 */
const getTemplate = (templateName: string): HandlebarsTemplateDelegate => {
    if (templateCache.has(templateName)) {
        return templateCache.get(templateName)!;
    }

    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template ${templateName} not found at ${templatePath}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiled = Handlebars.compile(templateSource);
    templateCache.set(templateName, compiled);
    
    return compiled;
};

/**
 * Renders an email template wrapped in the base layout.
 * @param templateName The template name (e.g. 'otp', 'welcome')
 * @param data Variables to inject into the template
 */
export const renderEmailHtml = (templateName: string, data: Record<string, any>): string => {
    // 1. Compile inner content
    const template = getTemplate(templateName);
    const bodyHtml = template(data);

    // 2. Wrap in layout
    const layout = getLayout();
    const finalHtml = layout({
        ...data,
        body: bodyHtml,
        year: new Date().getFullYear(),
    });

    return finalHtml;
};
