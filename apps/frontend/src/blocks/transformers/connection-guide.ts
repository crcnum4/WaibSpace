import type {
  ComponentBlock,
  SurfaceSpec,
  EmitAction,
} from "@waibspace/types";
import type { ConnectionGuideSurfaceData } from "@waibspace/surfaces";

function browseStep(
  data: ConnectionGuideSurfaceData,
  sid: string,
): ComponentBlock[] {
  const blocks: ComponentBlock[] = [];

  blocks.push({
    id: `${sid}-browse-header`,
    type: "Text",
    props: { content: data.message, variant: "body" },
  });

  if (data.availableServices && data.availableServices.length > 0) {
    const serviceCards: ComponentBlock[] = data.availableServices.map(
      (service, i) => ({
        id: `${sid}-service-item-${i}`,
        type: "ListItem",
        props: {},
        children: [
          {
            id: `${sid}-service-icon-${i}`,
            type: "Image",
            props: { src: service.icon, alt: service.name },
          },
          {
            id: `${sid}-service-stack-${i}`,
            type: "Stack",
            props: {},
            children: [
              {
                id: `${sid}-service-name-${i}`,
                type: "Text",
                props: { content: service.name, variant: "bold" },
              },
              {
                id: `${sid}-service-desc-${i}`,
                type: "Text",
                props: { content: service.description, variant: "caption" },
              },
            ],
          },
        ],
        events: {
          onClick: {
            action: "emit",
            event: "user.interaction",
            payload: {
              actionType: "connection.selectService",
              serviceId: service.id,
            },
          } satisfies EmitAction,
        },
      }),
    );

    blocks.push({
      id: `${sid}-service-grid`,
      type: "Grid",
      props: {},
      children: serviceCards,
    });
  }

  return blocks;
}

function credentialsStep(
  data: ConnectionGuideSurfaceData,
  sid: string,
): ComponentBlock[] {
  const blocks: ComponentBlock[] = [];

  blocks.push({
    id: `${sid}-cred-header`,
    type: "Text",
    props: { content: data.message, variant: "body" },
  });

  if (data.credentialFields && data.credentialFields.length > 0) {
    const fields: ComponentBlock[] = data.credentialFields.map((field, i) => ({
      id: `${sid}-cred-field-${i}`,
      type: "Stack",
      props: {},
      children: [
        {
          id: `${sid}-cred-label-${i}`,
          type: "Text",
          props: { content: field.label, variant: "body" },
        },
        {
          id: `${sid}-cred-input-${i}`,
          type: "TextInput",
          props: {
            placeholder: field.helpText,
            sensitive: field.sensitive,
          },
        },
      ],
    }));

    blocks.push({
      id: `${sid}-cred-stack`,
      type: "Stack",
      props: {},
      children: fields,
    });

    blocks.push({
      id: `${sid}-cred-submit`,
      type: "Button",
      props: { label: "Connect", variant: "primary" },
      events: {
        onClick: {
          action: "emit",
          event: "user.interaction",
          payload: { actionType: "connection.submitCredentials" },
        } satisfies EmitAction,
      },
    });
  }

  return blocks;
}

function statusStep(
  data: ConnectionGuideSurfaceData,
  sid: string,
): ComponentBlock[] {
  const colorMap: Record<string, string> = {
    connecting: "yellow",
    success: "green",
    error: "red",
  };

  const blocks: ComponentBlock[] = [
    {
      id: `${sid}-status-message`,
      type: "Text",
      props: { content: data.message, variant: "body" },
    },
    {
      id: `${sid}-status-badge`,
      type: "Badge",
      props: {
        label: data.step,
        color: colorMap[data.step] ?? "gray",
      },
    },
  ];

  if (data.step === "error" && data.errorDetail) {
    blocks.push({
      id: `${sid}-error-detail`,
      type: "Text",
      props: { content: data.errorDetail, variant: "caption" },
    });
  }

  return blocks;
}

export function connectionGuideToBlocks(
  spec: SurfaceSpec,
): ComponentBlock[] {
  const data = spec.data as ConnectionGuideSurfaceData;
  const sid = spec.surfaceId;

  let stepBlocks: ComponentBlock[];

  switch (data.step) {
    case "browse":
      stepBlocks = browseStep(data, sid);
      break;
    case "credentials":
      stepBlocks = credentialsStep(data, sid);
      break;
    case "connecting":
    case "success":
    case "error":
      stepBlocks = statusStep(data, sid);
      break;
    default:
      stepBlocks = [
        {
          id: `${sid}-unknown-step`,
          type: "Text",
          props: { content: `Unknown step: ${data.step}`, variant: "body" },
        },
      ];
  }

  return [
    {
      id: `${sid}-root`,
      type: "Container",
      props: { direction: "column", gap: "12px", padding: "var(--space-5)" },
      children: [
        {
          id: `${sid}-header`,
          type: "Text",
          props: { content: spec.title, variant: "h3" },
        },
        ...stepBlocks,
      ],
      meta: {
        surfaceId: spec.surfaceId,
        surfaceType: "connection-guide",
        provenance: spec.provenance,
        layoutHints: spec.layoutHints,
      },
    },
  ];
}
