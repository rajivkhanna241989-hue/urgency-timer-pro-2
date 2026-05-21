import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  return { shop };
};

export default function SetupInstructions() {
  const { shop } = useLoaderData();
  const themeEditorUrl = `https://${shop}/admin/themes/current/editor?template=product`;

  return (
    <s-page heading="How to Add the Low Stock Bar to Your Store">

      <s-section heading="Step 1 — Open Your Theme Editor">
        <s-stack direction="block" gap="base">
          <s-text>Click the button below to open your theme editor on the product page template.</s-text>
          <s-button variant="primary" onClick={() => window.open(themeEditorUrl, "_blank")}>
            Open Theme Editor
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Step 2 — Add the Low Stock Bar Block">
        <s-stack direction="block" gap="base">
          <s-text>Once the theme editor opens:</s-text>
          <s-stack direction="block" gap="tight">
            <s-text>1. In the left sidebar find the <strong>Product information</strong> section</s-text>
            <s-text>2. Click <strong>Add block</strong></s-text>
            <s-text>3. Scroll down to the <strong>Apps</strong> section</s-text>
            <s-text>4. Click <strong>Low Stock Bar</strong> to add it</s-text>
            <s-text>5. Drag it to position it just below the product price</s-text>
            <s-text>6. Click <strong>Save</strong> in the top right corner</s-text>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Step 3 — Customise Your Bar">
        <s-stack direction="block" gap="base">
          <s-text>Go back to the <strong>Home</strong> tab in this app to customise the bar colours, height, and message text. Changes will appear automatically on your store.</s-text>
        </s-stack>
      </s-section>

      <s-section heading="Need Help?">
        <s-stack direction="block" gap="base">
          <s-text>If you have any questions or run into any issues setting up the Low Stock Bar, please contact our support team and we will get back to you within 24 hours.</s-text>
        </s-stack>
      </s-section>

    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
