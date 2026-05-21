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
  const themeEditorUrl = `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=494415ab-1315-e13d-87fa-3bb1e9f1745b37850bea/star_rating&target=mainSection`;

  return (
    <s-page heading="How to Add the Low Stock Bar to Your Store">

      <s-section heading="Step 1 — Open Your Theme Editor">
        <s-stack direction="block" gap="base">
          <s-text>Click the button below to open your theme editor and add the Low Stock Bar directly to your product pages.</s-text>
          <s-button variant="primary" onClick={() => window.open(themeEditorUrl, "_blank")}>
            Add Low Stock Bar to Theme
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Step 2 — Position the Block">
        <s-stack direction="block" gap="base">
          <s-text>Once the theme editor opens:</s-text>
          <s-stack direction="block" gap="tight">
            <s-text>1. The Low Stock Bar block will be added automatically</s-text>
            <s-text>2. Drag it to position it just below the product price</s-text>
            <s-text>3. Click <strong>Save</strong> in the top right corner</s-text>
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
