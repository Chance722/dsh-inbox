window.__ModuleLoader__.load({
	id: "@chance722/dsh-inbox",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		"use strict";
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name2 in all)
		    __defProp(target, name2, { get: all[name2], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
		  // If the importer is in node compatibility mode or this is not an ESM
		  // file that has been converted to a CommonJS file using a Babel-
		  // compatible transform (i.e. "__esModule" has not been set), then set
		  // "default" to the CommonJS "module.exports" for node compatibility.
		  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
		  mod
		));
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
		
		// src/client/index.tsx
		var index_exports = {};
		__export(index_exports, {
		  apply: () => apply,
		  inject: () => inject,
		  name: () => name
		});
		module.exports = __toCommonJS(index_exports);
		var import_react8 = __toESM(require("react"), 1);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/createLucideIcon.mjs
		var import_react3 = require("react");
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs
		var toKebabCase = (string) => string?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/toLucideIconData.mjs
		function toLucideIconData(iconName, iconNode, aliases = []) {
		  if (iconNode == null) {
		    throw new Error("[lucide]: iconNode is required when icon name is used");
		  }
		  return {
		    name: toKebabCase(iconName),
		    size: 24,
		    node: iconNode,
		    ...aliases.length > 0 ? { aliases } : {}
		  };
		}
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
		var toCamelCase = (string) => {
		  let out = "";
		  let upperNext = false;
		  for (const ch of string) {
		    if (ch === "-" || ch === "_" || ch <= " ") {
		      upperNext = out.length > 0;
		      continue;
		    }
		    if (out.length === 0) {
		      out += ch.toLowerCase();
		    } else {
		      out += upperNext ? ch.toUpperCase() : ch;
		    }
		    upperNext = false;
		  }
		  return out;
		};
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
		var toPascalCase = (string) => {
		  const camelCase = toCamelCase(string);
		  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
		};
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/Icon.mjs
		var import_react2 = require("react");
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
		var mergeClasses = (...classes) => classes.filter((className, index, array) => {
		  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
		}).join(" ").trim();
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/build/defaultAttributes.mjs
		var defaultAttributes = {
		  xmlns: "http://www.w3.org/2000/svg",
		  width: 24,
		  height: 24,
		  viewBox: "0 0 24 24",
		  fill: "none",
		  stroke: "currentColor",
		  "stroke-width": 2,
		  "stroke-linecap": "round",
		  "stroke-linejoin": "round"
		};
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs
		function isDefined(value) {
		  return value !== null && value !== void 0;
		}
		function buildLucideIconNode(icon, params = {}) {
		  const attributeNames = params.attributeNames ?? {};
		  const getAttributeName = (attributeName) => attributeNames[attributeName] ?? attributeName;
		  const viewBoxWidth = icon.size ?? icon.width ?? defaultAttributes["width"];
		  const viewBoxHeight = icon.size ?? icon.height ?? defaultAttributes["height"];
		  const aliasClassNames = icon.aliases?.filter((alias) => typeof alias === "string" && alias.trim() !== "").map((alias) => `lucide-${alias}`) ?? [];
		  const iconClassNames = [...icon.name ? [`lucide-${icon.name}`] : [], ...aliasClassNames];
		  const classNamesFromClassName = params.className?.split(" ").filter(Boolean) ?? [];
		  const className = params.includeDefaultClasses === false ? mergeClasses(...classNamesFromClassName) : mergeClasses("lucide", ...iconClassNames, ...classNamesFromClassName);
		  const calculatedStrokeWidth = params.absoluteStrokeWidth ? Number(params.strokeWidth ?? defaultAttributes["stroke-width"]) * Number(icon.size ?? icon.width ?? defaultAttributes["width"]) / Number(params.size ?? params.width ?? defaultAttributes["width"]) : params.strokeWidth ?? defaultAttributes["stroke-width"];
		  const attributes = {
		    ...Object.entries(defaultAttributes).reduce((attrs, [attrName, value]) => {
		      attrs[getAttributeName(attrName)] = value;
		      return attrs;
		    }, {}),
		    ..."color" in params && params.color && {
		      [getAttributeName("stroke")]: params.color
		    },
		    ..."size" in params && isDefined(params.size) && {
		      [getAttributeName("width")]: params.size,
		      [getAttributeName("height")]: params.size
		    },
		    ..."width" in params && isDefined(params.width) && {
		      [getAttributeName("width")]: params.width
		    },
		    ..."height" in params && isDefined(params.height) && {
		      [getAttributeName("height")]: params.height
		    },
		    [getAttributeName("stroke-width")]: calculatedStrokeWidth,
		    ...className && {
		      [getAttributeName("class")]: className
		    },
		    [getAttributeName("viewBox")]: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
		    ...params.hasA11yProp === false ? {
		      [getAttributeName("aria-hidden")]: "true"
		    } : {},
		    ..."attributes" in params && params.attributes
		  };
		  return [
		    "svg",
		    attributes,
		    icon.node.map((child) => {
		      const [name2, attrs, children] = child;
		      const nextAttrs = params.nonScalingStroke ? { [getAttributeName("vector-effect")]: "non-scaling-stroke", ...attrs } : attrs;
		      return children ? [name2, nextAttrs, children] : [name2, nextAttrs];
		    })
		  ];
		}
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconForReact.mjs
		function buildLucideIconForReact(icon, params = {}) {
		  return buildLucideIconNode(icon, {
		    ...params,
		    attributeNames: {
		      ...params.attributeNames,
		      class: "className",
		      "stroke-width": "strokeWidth",
		      "stroke-linecap": "strokeLinecap",
		      "stroke-linejoin": "strokeLinejoin",
		      "vector-effect": "vectorEffect"
		    }
		  });
		}
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
		var hasA11yProp = (props) => {
		  for (const prop in props) {
		    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
		      return true;
		    }
		  }
		  return false;
		};
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/context.mjs
		var import_react = require("react");
		var LucideContext = (0, import_react.createContext)({});
		var useLucideContext = () => (0, import_react.useContext)(LucideContext);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/Icon.mjs
		var Icon = (0, import_react2.forwardRef)(
		  ({
		    color,
		    size,
		    width,
		    height,
		    strokeWidth,
		    absoluteStrokeWidth,
		    nonScalingStroke,
		    className = "",
		    children,
		    iconNode = [],
		    icon = {
		      node: iconNode,
		      aliases: [],
		      size: 24
		    },
		    ...rest
		  }, ref) => {
		    const {
		      size: contextSize = 24,
		      strokeWidth: contextStrokeWidth = 2,
		      absoluteStrokeWidth: contextAbsoluteStrokeWidth = false,
		      nonScalingStroke: contextNonScalingStroke = false,
		      color: contextColor = "currentColor",
		      className: contextClass = ""
		    } = useLucideContext() ?? {};
		    const hasAccessibleProp = Boolean(children) || hasA11yProp(rest);
		    const [name2, svgAttributes, builtIconNode = []] = buildLucideIconForReact(icon, {
		      color: color ?? contextColor,
		      width: width ?? size ?? contextSize,
		      height: height ?? size ?? contextSize,
		      strokeWidth: strokeWidth ?? contextStrokeWidth,
		      absoluteStrokeWidth: absoluteStrokeWidth ?? contextAbsoluteStrokeWidth,
		      nonScalingStroke: nonScalingStroke ?? contextNonScalingStroke,
		      className: mergeClasses(contextClass, className),
		      hasA11yProp: hasAccessibleProp,
		      attributes: rest
		    });
		    return (0, import_react2.createElement)(
		      name2,
		      {
		        ref,
		        ...svgAttributes
		      },
		      [
		        ...builtIconNode.map(([tag, attrs]) => (0, import_react2.createElement)(tag, attrs)),
		        ...Array.isArray(children) ? children : [children]
		      ]
		    );
		  }
		);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/createLucideIcon.mjs
		function createLucideIcon(iconDataOrName, iconNode = [], aliases = []) {
		  const iconData = typeof iconDataOrName === "string" ? toLucideIconData(iconDataOrName, iconNode, aliases) : iconDataOrName;
		  const Component = (0, import_react3.forwardRef)(
		    ({ className, ...props }, ref) => (0, import_react3.createElement)(Icon, {
		      ref,
		      icon: iconData,
		      className,
		      ...props
		    })
		  );
		  if (iconData.name) {
		    Component.displayName = toPascalCase(iconData.name);
		  }
		  return Component;
		}
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/bookmark.mjs
		var __iconData = {
		  name: "bookmark",
		  size: 24,
		  node: [
		    [
		      "path",
		      {
		        d: "M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",
		        key: "oz39mx"
		      }
		    ]
		  ]
		};
		__iconData.node;
		var Bookmark = createLucideIcon(__iconData);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/check.mjs
		var __iconData2 = {
		  name: "check",
		  size: 24,
		  node: [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]
		};
		__iconData2.node;
		var Check = createLucideIcon(__iconData2);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/chevron-down.mjs
		var __iconData3 = {
		  name: "chevron-down",
		  size: 24,
		  node: [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]]
		};
		__iconData3.node;
		var ChevronDown = createLucideIcon(__iconData3);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/chevron-left.mjs
		var __iconData4 = {
		  name: "chevron-left",
		  size: 24,
		  node: [["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]]
		};
		__iconData4.node;
		var ChevronLeft = createLucideIcon(__iconData4);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/chevron-right.mjs
		var __iconData5 = {
		  name: "chevron-right",
		  size: 24,
		  node: [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]]
		};
		__iconData5.node;
		var ChevronRight = createLucideIcon(__iconData5);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/circle.mjs
		var __iconData6 = {
		  name: "circle",
		  size: 24,
		  node: [["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]]
		};
		__iconData6.node;
		var Circle = createLucideIcon(__iconData6);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/external-link.mjs
		var __iconData7 = {
		  name: "external-link",
		  size: 24,
		  node: [
		    ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
		    ["path", { d: "M10 14 21 3", key: "gplh6r" }],
		    ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
		  ]
		};
		__iconData7.node;
		var ExternalLink = createLucideIcon(__iconData7);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/file-text.mjs
		var __iconData8 = {
		  name: "file-text",
		  size: 24,
		  node: [
		    [
		      "path",
		      {
		        d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
		        key: "1oefj6"
		      }
		    ],
		    ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
		    ["path", { d: "M10 9H8", key: "b1mrlr" }],
		    ["path", { d: "M16 13H8", key: "t4e002" }],
		    ["path", { d: "M16 17H8", key: "z1uh3a" }]
		  ]
		};
		__iconData8.node;
		var FileText = createLucideIcon(__iconData8);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/film.mjs
		var __iconData9 = {
		  name: "film",
		  size: 24,
		  node: [
		    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
		    ["path", { d: "M7 3v18", key: "bbkbws" }],
		    ["path", { d: "M3 7.5h4", key: "zfgn84" }],
		    ["path", { d: "M3 12h18", key: "1i2n21" }],
		    ["path", { d: "M3 16.5h4", key: "1230mu" }],
		    ["path", { d: "M17 3v18", key: "in4fa5" }],
		    ["path", { d: "M17 7.5h4", key: "myr1c1" }],
		    ["path", { d: "M17 16.5h4", key: "go4c1d" }]
		  ]
		};
		__iconData9.node;
		var Film = createLucideIcon(__iconData9);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/id-card.mjs
		var __iconData10 = {
		  name: "id-card",
		  size: 24,
		  node: [
		    ["path", { d: "M13 19a4 4 0 00-8 0", key: "cugzd5" }],
		    ["path", { d: "M16 10h2", key: "8sgtl7" }],
		    ["path", { d: "M16 14h2", key: "epxaof" }],
		    ["circle", { cx: "9", cy: "12", r: "3", key: "u3jwor" }],
		    ["rect", { x: "2", y: "5", width: "20", height: "14", rx: "2", key: "qneu4z" }]
		  ]
		};
		__iconData10.node;
		var IdCard = createLucideIcon(__iconData10);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/image.mjs
		var __iconData11 = {
		  name: "image",
		  size: 24,
		  node: [
		    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
		    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
		    ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }]
		  ]
		};
		__iconData11.node;
		var Image = createLucideIcon(__iconData11);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/inbox.mjs
		var __iconData12 = {
		  name: "inbox",
		  size: 24,
		  node: [
		    ["polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12", key: "o97t9d" }],
		    [
		      "path",
		      {
		        d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
		        key: "oot6mr"
		      }
		    ]
		  ]
		};
		__iconData12.node;
		var Inbox = createLucideIcon(__iconData12);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/key-round.mjs
		var __iconData13 = {
		  name: "key-round",
		  size: 24,
		  node: [
		    [
		      "path",
		      {
		        d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
		        key: "1s6t7t"
		      }
		    ],
		    ["circle", { cx: "16.5", cy: "7.5", r: ".5", fill: "currentColor", key: "w0ekpg" }]
		  ]
		};
		__iconData13.node;
		var KeyRound = createLucideIcon(__iconData13);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/layers.mjs
		var __iconData14 = {
		  name: "layers",
		  size: 24,
		  node: [
		    [
		      "path",
		      {
		        d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
		        key: "zw3jo"
		      }
		    ],
		    [
		      "path",
		      {
		        d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",
		        key: "1wduqc"
		      }
		    ],
		    [
		      "path",
		      {
		        d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",
		        key: "kqbvx6"
		      }
		    ]
		  ],
		  aliases: ["layers-3"]
		};
		__iconData14.node;
		var Layers = createLucideIcon(__iconData14);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/layout-grid.mjs
		var __iconData15 = {
		  name: "layout-grid",
		  size: 24,
		  node: [
		    ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1", key: "1g98yp" }],
		    ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1", key: "6d4xhi" }],
		    ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1", key: "nxv5o0" }],
		    ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }]
		  ]
		};
		__iconData15.node;
		var LayoutGrid = createLucideIcon(__iconData15);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/lightbulb.mjs
		var __iconData16 = {
		  name: "lightbulb",
		  size: 24,
		  node: [
		    [
		      "path",
		      {
		        d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
		        key: "1gvzjb"
		      }
		    ],
		    ["path", { d: "M9 18h6", key: "x1upvd" }],
		    ["path", { d: "M10 22h4", key: "ceow96" }]
		  ]
		};
		__iconData16.node;
		var Lightbulb = createLucideIcon(__iconData16);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/play.mjs
		var __iconData17 = {
		  name: "play",
		  size: 24,
		  node: [
		    [
		      "path",
		      {
		        d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
		        key: "10ikf1"
		      }
		    ]
		  ]
		};
		__iconData17.node;
		var Play = createLucideIcon(__iconData17);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/refresh-cw.mjs
		var __iconData18 = {
		  name: "refresh-cw",
		  size: 24,
		  node: [
		    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
		    ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
		    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
		    ["path", { d: "M8 16H3v5", key: "1cv678" }]
		  ]
		};
		__iconData18.node;
		var RefreshCw = createLucideIcon(__iconData18);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/rotate-ccw.mjs
		var __iconData19 = {
		  name: "rotate-ccw",
		  size: 24,
		  node: [
		    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
		    ["path", { d: "M3 3v5h5", key: "1xhq8a" }]
		  ]
		};
		__iconData19.node;
		var RotateCcw = createLucideIcon(__iconData19);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/settings-2.mjs
		var __iconData20 = {
		  name: "settings-2",
		  size: 24,
		  node: [
		    ["path", { d: "M14 17H5", key: "gfn3mx" }],
		    ["path", { d: "M19 7h-9", key: "6i9tg" }],
		    ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }],
		    ["circle", { cx: "7", cy: "7", r: "3", key: "dfmy0x" }]
		  ]
		};
		__iconData20.node;
		var Settings2 = createLucideIcon(__iconData20);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/tag.mjs
		var __iconData21 = {
		  name: "tag",
		  size: 24,
		  node: [
		    [
		      "path",
		      {
		        d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",
		        key: "vktsd0"
		      }
		    ],
		    ["circle", { cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor", key: "kqv944" }]
		  ]
		};
		__iconData21.node;
		var Tag = createLucideIcon(__iconData21);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/trash.mjs
		var __iconData22 = {
		  name: "trash",
		  size: 24,
		  node: [
		    ["path", { d: "M10 11v6", key: "nco0om" }],
		    ["path", { d: "M14 11v6", key: "outv1u" }],
		    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" }],
		    ["path", { d: "M3 6h18", key: "d0wm0j" }],
		    ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }]
		  ],
		  aliases: ["trash-2"]
		};
		__iconData22.node;
		var Trash = createLucideIcon(__iconData22);
		
		// node_modules/.pnpm/lucide-react@1.47.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/x.mjs
		var __iconData23 = {
		  name: "x",
		  size: 24,
		  node: [
		    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
		    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
		  ]
		};
		__iconData23.node;
		var X = createLucideIcon(__iconData23);
		
		// src/shared/panel-wire.ts
		var INBOX_API_PREFIX = "/api/inbox";
		var INBOX_ENDPOINT_CAPTURE = "capture";
		var INBOX_ENDPOINT_LIST = "list";
		var INBOX_ENDPOINT_DETAIL = "detail";
		var INBOX_ENDPOINT_UPDATE = "update";
		var INBOX_ENDPOINT_DELETE = "delete";
		var INBOX_ENDPOINT_RESTORE = "restore";
		var INBOX_ENDPOINT_PURGE = "purge";
		var INBOX_ENDPOINT_ATTACHMENT = "attachment";
		var INBOX_ENDPOINT_WEBDAV = "webdav";
		var INBOX_ENDPOINT_PULL = "pull";
		var INBOX_ENDPOINT_PROBE = "probe";
		var INBOX_ENDPOINT_UI = "ui";
		var INBOX_ENDPOINT_TAGS = "tags";
		var INBOX_ENDPOINT_SECRET = "secret";
		var INBOX_ENDPOINT_PUSH = "push";
		var DEFAULT_SYNC_DIRECTORY = "inbox";
		function syncDirectory(raw) {
		  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
		  return trimmed.length === 0 ? DEFAULT_SYNC_DIRECTORY : trimmed;
		}
		function syncRootFor(raw) {
		  return `${syncDirectory(raw)}/sync`;
		}
		function isSuccess(status) {
		  return status >= 200 && status < 300;
		}
		function probeVerdict(rows) {
		  if (rows.length === 0) return { ok: false, title: "\u6CA1\u6709\u53EF\u7528\u7684\u81EA\u68C0\u7ED3\u679C" };
		  const winner = rows.find((row) => isSuccess(row.status));
		  if (winner !== void 0) {
		    const shape = winner.label.replace(/\s*（[^）]*）\s*/g, "").trim();
		    return { ok: true, title: `\u901A\u9053\u53EF\u7528\uFF08\u53EF\u7528\u5F62\u72B6\uFF1A${shape}\uFF09` };
		  }
		  const statuses = new Set(rows.map((row) => row.status));
		  if (statuses.has(0)) {
		    const failed = rows.find((row) => row.status === 0);
		    return { ok: false, title: "\u8FDE\u4E0D\u4E0A", hint: failed?.detail ?? "" };
		  }
		  if (statuses.size === 1 && statuses.has(401)) {
		    return {
		      ok: false,
		      title: "\u8BA4\u8BC1\u88AB\u62D2\uFF08\u6BCF\u4E00\u884C\u90FD\u662F 401\uFF09",
		      hint: "\u4E0D\u662F\u7B7E\u540D\u5199\u6CD5\u7684\u95EE\u9898\uFF1A\u628A\u300C\u5BA2\u6237\u7AEF\u6807\u8BC6\u300D\u586B\u6210 AccessKey \u7ED1\u5B9A\u7684\u5E94\u7528\u540D\uFF08\u6570\u636E\u80F6\u56CA\u63A7\u5236\u53F0\u91CC\u521B\u5EFA key \u65F6\u9009\u7684\u90A3\u4E2A\uFF09\uFF0C\u6216\u8005\u6362\u4E00\u6B21\u5BC6\u94A5\uFF0C\u518D\u81EA\u68C0\u3002"
		    };
		  }
		  if (statuses.size === 1 && statuses.has(403)) {
		    return {
		      ok: false,
		      title: "\u6743\u9650\u88AB\u62D2\uFF08\u6BCF\u4E00\u884C\u90FD\u662F 403\uFF09",
		      hint: "\u5BC6\u94A5\u8BA4\u51FA\u6765\u4E86\uFF0C\u4F46\u4E0D\u5141\u8BB8\u8FD9\u4E2A\u64CD\u4F5C\uFF1A\u68C0\u67E5\u6876/\u76EE\u5F55\u7684\u6388\u6743\uFF0C\u4EE5\u53CA\u5BA2\u6237\u7AEF\u6807\u8BC6\u662F\u5426\u4E0E\u8BE5 AccessKey \u7ED1\u5B9A\u7684\u5E94\u7528\u4E00\u81F4\u3002"
		    };
		  }
		  if (statuses.size === 1 && statuses.has(404)) {
		    return { ok: false, title: "\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF08\u6BCF\u4E00\u884C\u90FD\u662F 404\uFF09", hint: "\u68C0\u67E5\u6876\u540D\u3001endpoint \u4E0E\u76EE\u5F55\u524D\u7F00\u3002" };
		  }
		  const first = rows[0]?.status ?? 0;
		  return {
		    ok: false,
		    title: `\u901A\u9053\u4E0D\u53EF\u7528\uFF08\u6536\u5230\u7684\u72B6\u6001\uFF1A${[...statuses].join(" / ")}\uFF09`,
		    hint: `\u9010\u884C\u770B\u4E0B\u9762\u7684\u8BE6\u60C5\uFF1B\u7B2C\u4E00\u884C\u662F ${String(first)}\u3002`
		  };
		}
		var INBOX_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
		var PAGE_SIZE = 12;
		var UI_LIST_MODES = ["grid", "compact"];
		var MAX_TITLE_CHARS = 300;
		
		// src/shared/constants.ts
		var PACKAGE_NAME = "@chance722/dsh-inbox";
		var PANEL_ID = "inbox";
		
		// src/client/card.tsx
		var import_react6 = require("react");
		
		// src/client/dock.tsx
		var import_react5 = __toESM(require("react"), 1);
		
		// src/client/i18n.ts
		var import_react4 = require("react");
		
		// src/client/messages.ts
		var zh = {
		  // The record heading, shared by the list, the cards and the dock.
		  "heading.untitled": "\uFF08\u65E0\u6807\u9898\uFF09",
		  "heading.credential": "\u5BC6\u94A5 / \u8D26\u5BC6",
		  "heading.tooltip": "{name}\uFF08{note}\uFF09",
		  // Record kinds and categories, as the *panel* says them. The host keeps its
		  // own Chinese labels in `src/shared/vocabulary.ts` for the model and for the
		  // readable copy it writes to the cloud; these are the reader's language.
		  "kind.text": "\u6587\u672C",
		  "kind.link": "\u94FE\u63A5",
		  "kind.image": "\u56FE\u7247",
		  "kind.file": "\u6587\u4EF6",
		  "category.idea": "\u7075\u611F/\u5F85\u529E",
		  "category.article": "\u6587\u7AE0",
		  "category.media": "\u89C6\u9891/\u97F3\u9891",
		  "category.image": "\u56FE\u7247",
		  "category.document": "\u8BC1\u4EF6",
		  "category.secret": "\u5BC6\u94A5/\u8D26\u5BC6",
		  "category.other": "\u5176\u5B83",
		  "source.rule": "\u89C4\u5219\u5224\u5B9A",
		  "source.model": "\u6A21\u578B\u5224\u5B9A",
		  "source.user": "\u624B\u52A8\u5224\u5B9A",
		  "source.rule.hint": "\u672C\u5730\u89C4\u5219\u6309\u94FE\u63A5\u3001\u6587\u672C\u3001\u56FE\u7247\u7684\u5F62\u72B6\u5224\u7684\uFF0C\u6CA1\u6709\u8054\u7F51",
		  "source.model.hint": "\u89C4\u5219\u5224\u4E0D\u51FA\u6765\u624D\u4EA4\u7ED9\u6A21\u578B\u5224\u7684\uFF1B\u4F60\u8BF4\u7684\u8BDD\u6C38\u8FDC\u4F18\u5148\uFF0C\u968F\u65F6\u53EF\u4EE5\u6539",
		  "source.user.hint": "\u4F60\u81EA\u5DF1\u9009\u7684\u7C7B\u76EE\uFF0C\u89C4\u5219\u548C\u6A21\u578B\u90FD\u4E0D\u4F1A\u8986\u76D6\u5B83",
		  // Chrome above the list.
		  "app.settings": "\u8BBE\u7F6E",
		  "app.manual": "\u4F7F\u7528\u624B\u518C",
		  "app.counts": " \xB7 \u5171 {total} \u6761 \xB7 \u5F85\u770B {watch} \u6761 \xB7 \u56DE\u6536\u7AD9 {deleted} \u6761",
		  "app.refresh": "\u540C\u6B65",
		  "app.refreshing": "\u540C\u6B65\u4E2D\u2026",
		  "app.loading": "\u8BFB\u53D6\u4E2D\u2026",
		  "app.saving": "\u5904\u7406\u4E2D\u2026",
		  "app.filter": "\u7B5B\u9009",
		  "app.store": "\u5B58\u5165\u4ED3\u5E93",
		  "app.pickFile": "\u9009\u62E9\u6587\u4EF6",
		  "app.close": "\u5173\u95ED",
		  "app.remove": "\u79FB\u9664 {name}",
		  "app.prevPage": "\u4E0A\u4E00\u9875",
		  "app.nextPage": "\u4E0B\u4E00\u9875",
		  "pager.of": "\u7B2C {page} / {pages} \u9875",
		  "app.category": "\u7C7B\u76EE",
		  "app.tag": "\u6807\u7B7E",
		  "app.emptyBox": "\u8FD8\u6CA1\u4E1C\u897F\u53EF\u5B58\uFF1A\u7C98\u4E00\u6BB5\u6587\u5B57\u3001\u4E00\u4E2A\u94FE\u63A5\uFF0C\u6216\u8005\u628A\u56FE\u7247\u62D6\u8FDB\u6765",
		  "app.detail": "\u8BB0\u5F55\u8BE6\u60C5",
		  "app.noMatches": "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5F55\u3002",
		  "app.binEmpty": "\u56DE\u6536\u7AD9\u662F\u7A7A\u7684\u3002",
		  "app.matches": "{count} \u6761\u5339\u914D",
		  "app.attachments": "{count} \u4E2A\u9644\u4EF6",
		  "app.failedCount": "\u5931\u8D25 {count}",
		  "app.pickOne": "\u9009\u5DE6\u8FB9\u4E00\u6761\u770B\u770B\u8BE6\u60C5\u3002",
		  "app.unnamedFile": "\uFF08\u672A\u547D\u540D\uFF09",
		  // The capture box and the search box.
		  "capture.placeholder": "\u7C98\u8D34\u6587\u5B57\u3001\u94FE\u63A5\uFF0C\u6216\u628A\u56FE\u7247/\u6587\u4EF6\u62D6\u5230\u8FD9\u91CC\uFF08Ctrl+Enter \u5B58\u5165\uFF09",
		  "search.placeholder": "\u641C\u6807\u9898\u3001\u6B63\u6587\u3001\u94FE\u63A5\u3001\u5907\u6CE8\u2026",
		  "modes.label": "\u5217\u8868\u6A21\u5F0F",
		  "modes.titleOf": "\u5217\u8868\u6A21\u5F0F\uFF1A{label}",
		  "modes.grid": "\u7F51\u683C",
		  "modes.compact": "\u7D27\u51D1",
		  // Filters.
		  "filter.all": "\u5168\u90E8",
		  "filter.watch": "\u5F85\u770B",
		  "filter.bin": "\u56DE\u6536\u7AD9",
		  "filter.clearBin": "\u6E05\u7A7A\u56DE\u6536\u7AD9",
		  "filter.untagAll": "\u628A\u6807\u7B7E\u300C{tag}\u300D\u4ECE\u6240\u6709\u8BB0\u5F55\u4E0A\u79FB\u9664\uFF08\u8BB0\u5F55\u672C\u8EAB\u4E0D\u5220\uFF09",
		  // The detail pane.
		  "detail.name": "\u540D\u79F0",
		  "detail.nameTitle": "\u5217\u8868\u3001\u5361\u7247\u548C\u5BF9\u8BDD\u5361\u7247\u663E\u793A\u8FD9\u4E2A\u540D\u5B57\uFF1B\u7559\u7A7A\u5219\u7528\u6587\u4EF6\u540D\u6216\u5907\u6CE8\u515C\u5E95",
		  "detail.namePlaceholder": "\u540D\u79F0\uFF0C\u5982\uFF1A\u8EAB\u4EFD\u8BC1\u6B63\u9762\uFF08\u7559\u7A7A\u5219\u7528\u6587\u4EF6\u540D\u515C\u5E95\uFF09",
		  "detail.note": "\u5907\u6CE8",
		  "detail.noteTitle": "\u4F60\u5199\u7684\u6C38\u8FDC\u4F18\u5148\u4E8E\u6A21\u578B\u7684\u5224\u65AD",
		  "detail.notePlaceholder": "\u5907\u6CE8\uFF0C\u5982\uFF1A\u8EAB\u4EFD\u8BC1\u7167 / \u5F85\u770B\u89C6\u9891 / \u8FD9\u4E2A key \u662F\u6D4B\u8BD5\u73AF\u5883\u7684\uFF08\u6CA1\u8D77\u540D\u5B57\u65F6\uFF0C\u5B83\u4F1A\u9876\u4E0A\u5F53\u5217\u8868\u91CC\u7684\u540D\u5B57\uFF09",
		  "detail.tagsPlaceholder": "\u8F93\u5165\u6807\u7B7E\uFF0C\u5982\uFF1A\u524D\u7AEF, \u62A5\u9500\uFF08\u9017\u53F7\u5206\u9694\uFF09",
		  "detail.save": "\u4FDD\u5B58\u4EE5\u4E0A",
		  "detail.watch": "\u6807\u4E3A\u5F85\u770B",
		  "detail.unwatch": "\u53D6\u6D88\u5F85\u770B",
		  "detail.restore": "\u6062\u590D",
		  "detail.delete": "\u5220\u9664",
		  "detail.removeTag": "\u4ECE\u8FD9\u6761\u8BB0\u5F55\u4E0A\u79FB\u9664\u300C{tag}\u300D",
		  "detail.updated": " \xB7 \u66F4\u65B0 {when}",
		  "detail.sealedNote": "\u6B63\u6587\u662F\u5BC6\u6587\uFF0C\u89E3\u4E0D\u5F00\u3002\u5230\u300C\u8BBE\u7F6E \u2192 \u8D26\u5BC6\u52A0\u5BC6\u300D\u8F93\u4E3B\u5BC6\u7801\u89E3\u9501\uFF1B\u89E3\u4E0D\u5F00\u7684\u53C2\u6570\u8FD8\u6CA1\u5230\u672C\u673A\u65F6\uFF08\u5BC6\u6587\u662F\u540C\u6B65\u6765\u7684\uFF09\uFF0C\u5148\u70B9\u4E00\u6B21\u300C\u540C\u6B65\u300D\u3002",
		  "detail.play": "\u64AD\u653E",
		  "detail.zoom": "\u653E\u5927\u67E5\u770B",
		  "detail.playInBrowser": "\u5728\u6D4F\u89C8\u5668\u91CC\u64AD\u653E",
		  "detail.openInBrowser": "\u5728\u6D4F\u89C8\u5668\u6253\u5F00",
		  "detail.zoomInPanel": "\u5728\u9762\u677F\u91CC\u653E\u5927",
		  "detail.foreign": "\u8FD9\u6761\u662F\u5916\u7AD9\u7684\u5185\u5BB9",
		  "detail.foreignBody": "\u9762\u677F\u4E0D\u5185\u5D4C\u522B\u4EBA\u7684\u64AD\u653E\u5668\uFF0C\u6240\u4EE5\u5728\u6D4F\u89C8\u5668\u91CC\u6253\u5F00\u2014\u2014\u90A3\u91CC\u624D\u662F\u5927\u5C4F\u3002",
		  // Settings: credentials and remote.
		  "settings.secrets": "\u8D26\u5BC6\u52A0\u5BC6",
		  "settings.secretsBody": "\u8D26\u5BC6\u6B63\u6587\u52A0\u5BC6\u4FDD\u5B58\u3002\u5BC6\u94A5\u4E0D\u843D\u76D8\uFF1A\u91CD\u542F\u540E\u8981\u91CD\u65B0\u89E3\u9501\uFF0C\u4E3B\u5BC6\u7801\u5FD8\u4E86\u5C31\u89E3\u4E0D\u5F00\u3002",
		  "settings.lockedBody": "\u8F93\u4E00\u6B21\u4E3B\u5BC6\u7801\u89E3\u9501\uFF1B\u5BC6\u94A5\u4E0D\u843D\u76D8\uFF0C\u6240\u4EE5\u6BCF\u6B21\u91CD\u542F\u90FD\u8981\u8F93\u3002",
		  "settings.unlockedBody": "\u672C\u6B21\u8FD0\u884C\u671F\u95F4\u80FD\u8BFB\u5199\u8D26\u5BC6\uFF1B\u91CD\u542F\u540E\u8981\u91CD\u65B0\u89E3\u9501\u3002",
		  // 方向中立：先输的是哪一边的密码都成立（先输自己的、先输对方的，都可能是
		  // 这种状态），所以不写"那台机器"，只说"另一个主密码"。
		  "settings.otherPassword": "\u8FD8\u6709 {count} \u6761\u89E3\u4E0D\u5F00\uFF1A\u5B83\u4EEC\u662F\u53E6\u4E00\u4E2A\u4E3B\u5BC6\u7801\u52A0\u7684\u5BC6\uFF0C\u8F93\u90A3\u4E2A\u5BC6\u7801\u5C31\u80FD\u89E3\u5F00\u3002",
		  "settings.otherPasswordNoParams": "\u8FD8\u6709 {count} \u6761\u89E3\u4E0D\u5F00\uFF1A\u5B83\u4EEC\u6765\u81EA\u522B\u7684\u673A\u5668\uFF0C\u5148\u70B9\u4E00\u6B21\u300C\u540C\u6B65\u300D\u628A\u89E3\u9501\u53C2\u6570\u62C9\u56DE\u6765\u3002",
		  "settings.masterPassword": "\u4E3B\u5BC6\u7801",
		  "settings.masterPasswordSet": "\u8F93\u5165\u4E3B\u5BC6\u7801",
		  "settings.masterPasswordNew": "\u8BBE\u4E00\u4E2A\u4E3B\u5BC6\u7801",
		  "settings.unlock": "\u89E3\u9501",
		  "settings.lock": "\u9501\u5B9A",
		  "settings.setOrChange": "\u8BBE\u7F6E / \u66F4\u6362",
		  "settings.unlocked": "\u5DF2\u89E3\u9501",
		  "settings.locked": "\u5DF2\u9501\u5B9A",
		  "settings.lockedNote": "\u5DF2\u9501\u5B9A\uFF1A\u8D26\u5BC6\u6B63\u6587\u4E0D\u53EF\u8BFB\uFF0C\u76F4\u5230\u518D\u6B21\u89E3\u9501",
		  "settings.noPassword": "\u8FD8\u6CA1\u8BBE\u4E3B\u5BC6\u7801",
		  "settings.sealedNoParams": "\u6709 {count} \u6761\u5BC6\u6587\uFF0C\u89E3\u9501\u53C2\u6570\u8FD8\u6CA1\u5230\u672C\u673A",
		  "settings.sealedNoParamsBody": "\u5148\u70B9\u4E00\u6B21\u300C\u540C\u6B65\u300D\u628A\u53C2\u6570\u62C9\u56DE\u6765\uFF0C\u518D\u8F93\u539F\u6765\u90A3\u53F0\u673A\u5668\u7684\u4E3B\u5BC6\u7801\u3002",
		  "settings.passwordJustSet": "\u4E3B\u5BC6\u7801\u5DF2\u8BBE\u7F6E\uFF0C\u8D26\u5BC6\u4ECE\u6B64\u52A0\u5BC6\u843D\u76D8",
		  "settings.passwordSealed": "\u4E3B\u5BC6\u7801\u5DF2\u8BBE\u7F6E\uFF0C\u53E6\u6709 {count} \u6761\u65E7\u8BB0\u5F55\u5DF2\u4ECE\u660E\u6587\u6539\u4E3A\u5BC6\u6587",
		  "settings.ingest": "\u8FDC\u7AEF\u5165\u5E93",
		  "settings.ingestOnly": "\u53EA\u505A\u5355\u5411\uFF1A\u8FDC\u7AEF\u5F80\u91CC\u6254\uFF0C\u672C\u673A\u62C9\u4E0B\u6765\u5165\u5E93\u3002\u5BC6\u7801\u8D70 dsh \u7684\u51ED\u8BC1\u5E93\uFF0C\u4E0D\u5199\u8FDB\u914D\u7F6E\u3002",
		  "settings.protocol": "\u534F\u8BAE",
		  "settings.protocolHint": "\u6362\u534F\u8BAE\u540E\u8BB0\u5F97\u70B9\u4FDD\u5B58",
		  "settings.endpoint": "\u63A5\u5165\u70B9",
		  "settings.endpointPlaceholder": "s3.cstcloud.cn\uFF08\u4E0D\u5199\u534F\u8BAE\u9ED8\u8BA4 https\uFF09",
		  "settings.region": "\u533A\u57DF",
		  "settings.bucketAddress": "\u5730\u5740",
		  "settings.bucketDir": "\u76EE\u5F55",
		  "settings.adoptForeign": "\u540C\u65F6\u5408\u5E76\u522B\u7684\u540C\u6B65\u76EE\u5F55",
		  "settings.adoptForeignHint": "\uFF08\u6362\u8FC7\u76EE\u5F55\u7684\u673A\u5668\u7559\u5728\u4E91\u7AEF\u7684\u8BB0\u5F55\u4E5F\u4F1A\u62C9\u56DE\u6765\uFF1B\u9ED8\u8BA4\u5173\uFF09",
		  // The default is the thing people get wrong: blank and `/` are the same as
		  // `inbox`, and the sync tree is `<directory>/sync`.
		  "settings.directoryPlaceholder": "inbox\uFF08\u9ED8\u8BA4\uFF1B\u7559\u7A7A\u6216 / \u90FD\u7B49\u4E8E\u5B83\uFF09",
		  "settings.dirS3.lead": "\u76EE\u5F55\u90A3\u4E00\u680F\u540C\u65F6\u662F S3 \u7684 key \u524D\u7F00\uFF08\u9ED8\u8BA4 ",
		  "settings.dirS3.mid": "\uFF0C\u4F1A\u8F6C\u6210 ",
		  "settings.dirS3.tail": "\uFF09\u3002",
		  "settings.clientId": "\u5BA2\u6237\u7AEF\u6807\u8BC6",
		  "settings.clientIdS3": "\u7559\u7A7A\u5373 dsh-inbox\uFF1B\u6709\u4E9B\u7F51\u5173\u6309\u5B83\u8BA4\u4EBA\uFF0C\u586B\u6210\u8FD9\u4E2A AccessKey \u7ED1\u5B9A\u7684\u5E94\u7528\u540D",
		  "settings.clientIdWebdav": "\u7559\u7A7A\u5373 dsh-inbox\uFF1B\u6709\u4E9B\u7F51\u5173\u6309\u5B83\u8BA4\u4EBA\uFF0C\u586B\u6210\u8FD9\u4E2A WebDAV \u8D26\u53F7\u7ED1\u5B9A\u7684\u5E94\u7528\u540D",
		  "settings.username": "\u7528\u6237\u540D",
		  "settings.password": "\u5BC6\u7801",
		  "settings.passwordStored": "\u5DF2\u5B58\uFF08\u7559\u7A7A\u5219\u4E0D\u6539\uFF09",
		  "settings.passwordStore": "\u5B58\u5728 dsh \u7684\u51ED\u8BC1\u5E93\u91CC",
		  "settings.signature": "\u7B7E\u540D",
		  "settings.signatureV2": "v2\uFF08\u8001\u7F51\u5173\u591A\u534A\u8981\u8FD9\u4E2A\uFF09",
		  "settings.save": "\u4FDD\u5B58",
		  "settings.probe": "\u81EA\u68C0",
		  "settings.details": "\u8BE6\u60C5\uFF08{count} \u6B21\u8BF7\u6C42\uFF09",
		  "settings.syncRootNow": "\u540C\u6B65\u6839\uFF1A{root}",
		  "settings.noServiceBody": "\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u8BBE\u7F6E\u670D\u52A1\uFF0C\u5730\u5740\u6539\u4E0D\u4E86\u2014\u2014\u4F60\u591A\u534A\u5728\u7528 headless \u5F62\u6001\u5F00\u53D1\u3002",
		  "settings.bucketHint": "\u522B\u7684\u8BBE\u5907\u5F80\u8FD9\u91CC\u6254\u4E1C\u897F",
		  // Notices (the one-line status under the toolbar).
		  "notice.listFailed": "\u8BFB\u53D6\u5217\u8868\u5931\u8D25\uFF1A{reason}",
		  "notice.listUnreadable": "\u8BFB\u53D6\u5217\u8868\u5931\u8D25\uFF1A\u5BBF\u4E3B\u8FD4\u56DE\u7684\u5185\u5BB9\u770B\u4E0D\u61C2",
		  "notice.detailFailed": "\u8BFB\u53D6\u8BE6\u60C5\u5931\u8D25\uFF1A{reason}",
		  "notice.responseUnreadable": "\u5BBF\u4E3B\u8FD4\u56DE\u4E86\u770B\u4E0D\u61C2\u7684\u54CD\u5E94\uFF08HTTP {status}\uFF09",
		  "notice.listModeUnsaved": "\u5217\u8868\u6A21\u5F0F\u6CA1\u8BB0\u4F4F\uFF1A{reason}",
		  "notice.captureEmpty": "\u8FD8\u6CA1\u4E1C\u897F\u53EF\u5B58\uFF1A\u7C98\u4E00\u6BB5\u6587\u5B57\u3001\u4E00\u4E2A\u94FE\u63A5\uFF0C\u6216\u8005\u628A\u56FE\u7247\u62D6\u8FDB\u6765",
		  "notice.captureFailed": "\u6CA1\u5B58\u8FDB\u53BB\uFF1A{reason}",
		  "notice.saved": "\u5DF2\u5B58\u5165 {count} \u6761",
		  "notice.merged": "\u5408\u5E76 {count} \u6761\u91CD\u590D\u9879",
		  "notice.restored": "\u4ECE\u56DE\u6536\u7AD9\u53D6\u56DE {count} \u6761",
		  "notice.settingsSaved": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
		  "notice.settingsUnreadable": "\u8BFB\u4E0D\u5230\u8BBE\u7F6E\uFF1A{reason}",
		  "notice.settingsFailed": "\u6CA1\u5B58\u4E0A\uFF1A{reason}",
		  "notice.probeFailed": "\u81EA\u68C0\u5931\u8D25\uFF1A{reason}",
		  "notice.probeDone": "\u81EA\u68C0\u7ED3\u679C\u89C1\u4E0B\u65B9",
		  "notice.syncing": "\u540C\u6B65\u4E2D\u2026",
		  "notice.pushFailed": "\u63A8\u9001\u5931\u8D25\uFF1A{reason}",
		  "notice.pullFailed": "\u62C9\u53D6\u5931\u8D25\uFF1A{reason}",
		  "notice.tagRemoved": "\u6807\u7B7E\u300C{tag}\u300D\u5DF2\u79FB\u9664",
		  "notice.tagRemoveFailed": "\u5220\u6807\u7B7E\u5931\u8D25\uFF1A{reason}",
		  "notice.purgeFailed": "\u6E05\u7A7A\u5931\u8D25\uFF1A{reason}",
		  "notice.purgeNoRemote": "\uFF08\u6CA1\u914D\u8FDC\u7AEF\uFF09",
		  "notice.purgeRemote": "\uFF0C\u4E91\u7AEF\u5220\u4E86 {count} \u4E2A\u5BF9\u8C61",
		  "notice.purgeDone": "\u5DF2\u6E05\u7A7A {count} \u6761{remote}{failure}",
		  "notice.purgeFailedAtRemote": " \xB7 \u4E91\u7AEF\u6709\u5931\u8D25\uFF1A{reason}",
		  "confirm.untag": "\u628A\u6807\u7B7E\u300C{tag}\u300D\u4ECE {count} \u6761\u8BB0\u5F55\u4E0A\u79FB\u9664\uFF1F\u8BB0\u5F55\u672C\u8EAB\u4E0D\u4F1A\u88AB\u5220\u9664\u3002",
		  "confirm.purge": "\u6E05\u7A7A\u56DE\u6536\u7AD9\u4F1A\u771F\u7684\u5220\u6389\u8FD9\u4E9B\u8BB0\u5F55\uFF1A\u672C\u673A\u8BB0\u5F55\u3001\u4EE5\u53CA\u4E91\u76D8\u4E0A\u5BF9\u5E94\u7684\u540C\u6B65\u5BF9\u8C61\uFF08\u8BB0\u5F55 JSON/\u6587\u672C\u3001\u53EA\u88AB\u8FD9\u4E9B\u8BB0\u5F55\u5F15\u7528\u7684\u9644\u4EF6\uFF09\u3002\u4E0D\u80FD\u64A4\u9500\u3002dsh \u9644\u4EF6\u4ED3\u5E93\u91CC\u7684\u539F\u59CB\u5B57\u8282\u4ECD\u7136\u7559\u7740\u3002\u7EE7\u7EED\uFF1F",
		  // Sync lines (push/pull status).
		  "sync.pushUnconfigured": "\u63A8\u9001\uFF1A\u8FD8\u6CA1\u914D\u7F6E\u8FDC\u7AEF",
		  "sync.pushFailed": "\u63A8\u9001\u5931\u8D25\uFF1A{reason}",
		  "sync.pushUnknown": "\u672A\u77E5\u539F\u56E0",
		  "sync.pushPartial": "{head} \xB7 \u90E8\u5206\u5931\u8D25\uFF1A{reason}",
		  "sync.pullNoAddress": "\u8FD8\u6CA1\u914D\u7F6E\u5730\u5740",
		  "sync.pullFailed": "\u62C9\u53D6\u5931\u8D25\uFF1A{reason}",
		  // The refresh button's tooltip: counts first, reasons only when something was
		  // skipped. The toast carries the two numbers alone.
		  // No number here on purpose: the push considers every row it has, tombstones
		  // included, so "26 条已是最新" next to a header saying "共 13 条" is a
		  // mismatch the reader has to resolve for themselves (2026-09-21).
		  "sync.detailPushedIdle": "\u63A8\u9001 0 \u6761\uFF08\u6CA1\u6709\u65B0\u6539\u52A8\uFF09",
		  "sync.detailPushed": "\u63A8\u9001 {records} \u6761 / {attachments} \u4E2A\u9644\u4EF6",
		  "sync.detailPulled": "\u62C9\u53D6 {count} \u6761 \xB7 \u4E91\u7AEF {records} \u6761\u8BB0\u5F55 / {files} \u4E2A\u9644\u4EF6",
		  "sync.detailAdded": "\uFF08\u5176\u4E2D {count} \u6761\u662F\u65B0\u8BB0\u5F55\uFF09",
		  "sync.detailDeleted": "\uFF08\u5176\u4E2D {count} \u6761\u662F\u5220\u9664\uFF0C\u4F1A\u8FDB\u56DE\u6536\u7AD9\uFF09",
		  "sync.detailPurged": "\uFF08\u6E05\u7A7A\u8FC7 {count} \u6761\uFF1A\u4E91\u7AEF\u7684\u65E7\u526F\u672C\u6CA1\u6709\u62C9\u56DE\u6765\uFF09",
		  "sync.pullForeignSync": " \xB7 \u26A0\uFE0F \u53E6\u6709 {records} \u6761\u8BB0\u5F55\u5728\u522B\u7684\u540C\u6B65\u76EE\u5F55\uFF1A{roots}",
		  "sync.detailForeign": " \xB7 \u26A0\uFE0F \u522B\u7684\u540C\u6B65\u76EE\u5F55\uFF1A{roots}\uFF08{records} \u6761\u8BB0\u5F55\uFF1B\u672C\u673A {ours}\uFF09",
		  // The toast: two numbers, nothing else. Everything else about a sync is
		  // detail, and detail belongs in a line that does not vanish.
		  "sync.shortPushed": "\u63A8\u9001 {count} \u6761",
		  "sync.shortPulled": "\u62C9\u53D6 {count} \u6761",
		  "sync.shortIdle": "\u5DF2\u662F\u6700\u65B0",
		  "sync.pullFailures": " \xB7 \u5931\u8D25 {count}\uFF1A{reason}",
		  "settings.status": "{settings} \xB7 {webdav} \xB7 {s3}",
		  "settings.statusOn": "\u8BBE\u7F6E\u670D\u52A1\u5728",
		  "settings.statusOff": "\u6CA1\u6709\u8BBE\u7F6E\u670D\u52A1",
		  "settings.statusWebdavSet": "WebDAV \u5BC6\u7801\u5DF2\u5B58",
		  "settings.statusWebdavUnset": "\u8FD8\u6CA1\u5B58 WebDAV \u5BC6\u7801",
		  "settings.statusS3Set": "S3 \u5BC6\u94A5\u5DF2\u5B58",
		  "settings.statusS3Unset": "\u8FD8\u6CA1\u5B58 S3 \u5BC6\u94A5",
		  // Conversation cards.
		  "card.openThis": "\u5728\u53F3\u4FA7\u300C\u4ED3\u5E93\u300D\u91CC\u6253\u5F00\u8FD9\u6761",
		  "card.searchTitle": "\u{1F5C2} dsh-inbox \xB7 \u641C\u7D22\u4ED3\u5E93",
		  "card.getTitle": "\u{1F5C2} dsh-inbox \xB7 \u6253\u5F00\u8BB0\u5F55",
		  "card.error": " \xB7 \u51FA\u9519",
		  "card.open": "\u6253\u5F00",
		  "card.pending": "\uFF08\u8FD9\u6761\u8C03\u7528\u8FD8\u6CA1\u6709\u7ED3\u679C\uFF09",
		  // The dock beside the conversation.
		  "dock.title": "\u4ED3\u5E93",
		  "dock.description": "\u628A inbox \u653E\u5728\u5BF9\u8BDD\u65C1\u8FB9\uFF0C\u968F\u624B\u770B",
		  "dock.recent": "\u6700\u8FD1 {count} \u6761",
		  "dock.watch": " \xB7 \u5F85\u770B",
		  "dock.back": "\u56DE\u5230\u6700\u8FD1\u8BB0\u5F55",
		  "dock.backShort": "\u8FD4\u56DE\u6700\u8FD1",
		  "dock.note": "\u5907\u6CE8\uFF1A",
		  "dock.unavailable": "\u8BFB\u4E0D\u5230\u4ED3\u5E93\uFF0C\u53BB\u5DE6\u4FA7\u300C{panel}\u300D\u9762\u677F\u770B\u770B\u3002",
		  "dock.hint": "\u8FD9\u91CC\u662F\u968F\u624B\u770B\u3002\u6539\u7C7B\u76EE\u3001\u5220\u8BB0\u5F55\u3001\u5165\u5E93\u8BBE\u7F6E\u5728\u5DE6\u4FA7\u300C{panel}\u300D\u9762\u677F\u91CC\u3002",
		  "dock.gone": "\u8BFB\u4E0D\u5230\u8FD9\u6761\u8BB0\u5F55\uFF0C\u5B83\u53EF\u80FD\u5DF2\u7ECF\u88AB\u5220\u6389\u4E86\u3002",
		  "dock.editHint": "\u6539\u7C7B\u76EE\u3001\u6539\u5907\u6CE8\u3001\u5220\u9664\u90FD\u5728\u5DE6\u4FA7\u300C{panel}\u300D\u9762\u677F\u91CC\u3002",
		  // The manual, section by section.
		  "manual.title": "\u4F7F\u7528\u624B\u518C",
		  "manual.titleInline": "dsh-inbox \u600E\u4E48\u7528",
		  "manual.lead": "\u4E09\u5206\u949F\u770B\u5B8C",
		  "manual.separator": "\uFF1A",
		  "manual.1.title": "1. \u5F80\u91CC\u5B58",
		  "manual.1.panel.label": "\u9762\u677F",
		  "manual.1.panel.body": "\u7C98\u8D34\u6587\u5B57/\u94FE\u63A5\u3001\u62D6\u8FDB\u56FE\u7247\u6587\u4EF6\uFF0C\u6216\u70B9\u300C\u9009\u62E9\u6587\u4EF6\u2026\u300D\uFF0C\u7136\u540E\u300C\u5B58\u5165\u4ED3\u5E93\u300D\uFF08Ctrl+Enter \u4E5F\u884C\uFF09\u3002",
		  "manual.1.chat.label": "\u5BF9\u8BDD\u91CC",
		  "manual.1.chat.lead": "\u8F93\u5165 ",
		  "manual.1.chat.code": "/inbox \u6587\u5B57\u6216\u94FE\u63A5",
		  "manual.1.chat.tail": "\uFF0C\u56FE\u7247\u76F4\u63A5\u9644\u5728\u8F93\u5165\u6846\u4E0A\uFF1B\u4E0D\u53D1\u7ED9\u6A21\u578B\u3002",
		  "manual.1.repeat.label": "\u91CD\u590D",
		  "manual.1.repeat.body": "\u540C\u4E00\u6837\u4E1C\u897F\u518D\u5B58\u4E00\u6B21\u4E0D\u4F1A\u65B0\u589E\uFF0C\u4F1A\u5E76\u8FDB\u539F\u8BB0\u5F55\uFF1B\u5982\u679C\u5B83\u4E4B\u524D\u5728\u56DE\u6536\u7AD9\uFF0C\u4F1A\u987A\u624B\u53D6\u56DE\u6765\u3002",
		  "manual.2.title": "2. \u600E\u4E48\u7FFB\u3001\u600E\u4E48\u6539",
		  "manual.2.filter.label": "\u7B5B\u9009",
		  "manual.2.filter.body": "\u5DE6\u4FA7\u300C\u5168\u90E8 / \u5F85\u770B / \u56DE\u6536\u7AD9\u300D\u4E0E\u7C7B\u76EE\u3001\u6807\u7B7E\u4E92\u65A5\uFF1B\u300C\u5F85\u770B\u300D\u662F\u4F60\u81EA\u5DF1\u6253\u7684\u6807\u8BB0\uFF0C\u65B0\u8BB0\u5F55\u4E0D\u5E26\u4EFB\u4F55\u6807\u8BB0\u3002",
		  "manual.2.list.label": "\u5217\u8868",
		  "manual.2.list.body": "\u4E24\u79CD\u5BC6\u5EA6\uFF08\u4E24\u5217 / \u7D27\u51D1\uFF09\u968F\u624B\u5207\uFF0C\u4F1A\u8BB0\u4F4F\uFF1B\u4E0A\u9762\u641C\u7D22\u6846\u641C\u6807\u9898\u3001\u6B63\u6587\u3001\u94FE\u63A5\u3001\u5907\u6CE8\u3002",
		  "manual.2.detail.label": "\u8BE6\u60C5",
		  "manual.2.detail.body": "\u53F3\u8FB9\u4E00\u680F\u53EF\u4EE5\u6539\u540D\u79F0\u3001\u7C7B\u76EE\u3001\u5907\u6CE8\u3001\u6807\u7B7E\uFF0C\u4E5F\u80FD\u6807\u5F85\u770B\u3001\u5220\u9664\u3001\u6062\u590D\u3002",
		  "manual.3.title": "3. \u5217\u8868\u91CC\u663E\u793A\u7684\u540D\u5B57\u662F\u54EA\u513F\u6765\u7684",
		  "manual.3.order.label": "\u987A\u5E8F",
		  "manual.3.order.body": "\u4F60\u8D77\u7684\u540D\u79F0 \u2192 \u6293\u6765\u7684\u9875\u9762\u6807\u9898 \u2192 \u94FE\u63A5/\u6B63\u6587/\u6587\u4EF6\u540D \u2192 \u5907\u6CE8\uFF08\u6700\u540E\u515C\u5E95\uFF09\u3002",
		  "manual.3.icon.label": "\u7C7B\u76EE\u56FE\u6807",
		  "manual.3.icon.tail": " \u5404\u6709\u56FE\u6807\uFF1B\u5BC6\u94A5/\u8D26\u5BC6\u662F\u94A5\u5319\uFF0C\u4E00\u773C\u80FD\u8BA4\u51FA\u6765\u3002",
		  "manual.3.who.label": "\u8C01\u5224\u7684",
		  "manual.3.who.lead": "\u7C7B\u76EE\u65C1\u7684\u6807\u7B7E\u5206\u4E09\u79CD\uFF1A",
		  "manual.3.who.tail": "\uFF08\u4F60\u9009\u8FC7\u7684\u7C7B\u76EE\uFF0C\u89C4\u5219\u548C\u6A21\u578B\u90FD\u4E0D\u4F1A\u8986\u76D6\uFF09\u3002",
		  "manual.4.title": "4. \u5BC6\u94A5\u4E0E\u8D26\u5BC6",
		  "manual.4.password.label": "\u5148\u8BBE\u4E3B\u5BC6\u7801",
		  "manual.4.password.body": "\u8BBE\u7F6E \u2192 \u8D26\u5BC6\u52A0\u5BC6\u3002\u8BBE\u4E86\u4E4B\u540E\uFF0C\u8D26\u5BC6\u6B63\u6587\u4EE5\u5BC6\u6587\u5199\u76D8\uFF1B\u6CA1\u8BBE\u7684\u65F6\u5019\uFF0C\u8D26\u5BC6\u4E0D\u4F1A\u88AB\u5B58\u8FDB\u53BB\uFF08\u5B81\u53EF\u4E0D\u5B58\uFF0C\u4E5F\u4E0D\u5199\u660E\u6587\uFF09\u3002",
		  "manual.4.unlock.label": "\u6BCF\u6B21\u91CD\u542F\u8981\u89E3\u9501",
		  "manual.4.unlock.body": "\u4E3B\u5BC6\u7801\u548C\u5BC6\u94A5\u90FD\u4E0D\u843D\u76D8\uFF0C\u6240\u4EE5\u670D\u52A1\u4E00\u91CD\u542F\u5C31\u8981\u5728\u540C\u4E00\u4E2A\u5730\u65B9\u89E3\u9501\u4E00\u6B21\uFF1B\u5BC6\u7801\u5FD8\u4E86\u5C31\u89E3\u4E0D\u5F00\uFF0C\u6CA1\u6709\u627E\u56DE\u3002",
		  "manual.4.never.label": "\u6C38\u4E0D\u5916\u663E",
		  "manual.4.never.body": "\u5217\u8868\u91CC\u53EA\u663E\u793A\u4F60\u8D77\u7684\u540D\u5B57\uFF1B\u5BF9\u8BDD\u91CC\u53EA\u56DE\u4E00\u53E5\u300C\u660E\u6587\u4E0D\u4F1A\u901A\u8FC7\u5BF9\u8BDD\u8F93\u51FA\u300D\uFF1B\u53D1\u7ED9\u6A21\u578B\u7684\u5206\u7C7B\u8BF7\u6C42\u5148\u8131\u654F\u3002",
		  "manual.5.title": "5. \u540C\u6B65\uFF08\u672C\u673A \u2194 \u4E91\u76D8\uFF09",
		  "manual.5.auto.label": "\u81EA\u52A8",
		  "manual.5.auto.body": "\u5165\u5E93/\u6539\u52A8\u540E\u51E0\u79D2\u81EA\u52A8\u63A8\u9001\u4E00\u6B21\uFF08\u9632\u6296\uFF0C\u8FDE\u7740\u5B58\u4E94\u6761\u53EA\u4F1A\u63A8\u4E00\u6B21\uFF09\u3002",
		  "manual.5.manual.label": "\u624B\u52A8",
		  "manual.5.manual.body": "\u53F3\u4E0A\u89D2\u300C\u540C\u6B65\u300D\uFF1A\u5148\u63A8\u672C\u673A\u6539\u52A8\uFF0C\u518D\u62C9\u522B\u4EBA\u7684\uFF0C\u7136\u540E\u91CD\u8BFB\u5217\u8868\u3002",
		  // The one rule that decides whether two machines see each other at all.
		  "manual.5.twoMachines.label": "\u4E24\u53F0\u673A\u5668",
		  "manual.5.twoMachines.body": "\u4E24\u8FB9\u7684\u300C\u76EE\u5F55\u300D\u8981\u4E00\u6837\uFF08\u7559\u7A7A\u3001/\u3001inbox \u662F\u540C\u4E00\u4E2A\u610F\u601D\uFF09\u3002\u4E0D\u4E00\u6837\u65F6\u9ED8\u8BA4\u4E0D\u4E92\u901A\uFF1A\u540C\u6B65\u4F1A\u63D0\u793A\u300C\u53E6\u6709 N \u6761\u8BB0\u5F55\u5728\u522B\u7684\u540C\u6B65\u76EE\u5F55\u300D\u2014\u2014\u628A\u5B83\u4EEC\u6539\u6210\u540C\u4E00\u4E2A\uFF0C\u6216\u8005\u6253\u5F00\u8BBE\u7F6E\u91CC\u7684\u300C\u540C\u65F6\u5408\u5E76\u522B\u7684\u540C\u6B65\u76EE\u5F55\u300D\uFF0C\u90FD\u80FD\u5408\u8FC7\u6765\u3002",
		  "manual.5.delete.label": "\u5220\u9664",
		  "manual.5.delete.body": "\u9762\u677F\u91CC\u7684\u300C\u5220\u9664\u300D\u53EA\u662F\u628A\u5B83\u653E\u8FDB\u56DE\u6536\u7AD9\uFF08\u522B\u7684\u8BBE\u5907\u4E5F\u4F1A\u77E5\u9053\u5B83\u88AB\u5220\u4E86\uFF0C\u4E0D\u4F1A\u53C8\u88AB\u62C9\u56DE\u6765\uFF09\uFF1B\u300C\u6E05\u7A7A\u56DE\u6536\u7AD9\u300D\u624D\u662F\u771F\u5220\uFF0C\u4E91\u7AEF\u90A3\u4EFD\u4E5F\u4F1A\u4E00\u8D77\u5220\u3002",
		  "manual.5.merge.label": "\u5408\u5E76",
		  "manual.5.merge.body": "\u62C9\u56DE\u6765\u6309\u8BB0\u5F55\u7684 id + \u66F4\u65B0\u65F6\u95F4\u5408\u5E76\uFF1A\u8C01\u65B0\u8C01\u8D62\uFF0C\u4E0D\u7559\u51B2\u7A81\u526F\u672C\u3002",
		  "manual.5.cloud.label": "\u4E0A\u4E91\u4EC0\u4E48",
		  "manual.5.cloud.body": "\u8BB0\u5F55\u4E0E\u9644\u4EF6\u4E00\u8D77\u8D70\uFF1B\u53EA\u6709\u8D26\u5BC6\u6B63\u6587\u662F\u5BC6\u6587\uFF0C\u5176\u4F59\uFF08\u6587\u672C\u3001\u94FE\u63A5\u3001\u5907\u6CE8\u3001\u9644\u4EF6\uFF09\u662F\u660E\u6587\u2014\u2014\u6876\u52A1\u5FC5\u8BBE\u8BBF\u95EE\u63A7\u5236\u3002",
		  "manual.6.title": "6. \u5728\u5BF9\u8BDD\u91CC\u53D6\u56DE\u6765",
		  "manual.6.query.label": "\u67E5",
		  "manual.6.query.body": "\u5728\u5BF9\u8BDD\u91CC\u76F4\u63A5\u95EE\uFF1A\u300C\u6211\u7684\u6536\u4EF6\u7BB1\u91CC\u6709\u54EA\u4E9B\u8FD8\u6CA1\u770B\u7684\u94FE\u63A5\uFF1F\u300D\u52A9\u624B\u4F1A\u53BB\u4ED3\u5E93\u91CC\u627E\uFF0C \u6700\u591A\u5217 10 \u6761\uFF0C\u5E76\u544A\u8BC9\u4F60\u8FD8\u5269\u51E0\u6761\u3002\u53EB\u5B83\u300C\u6536\u4EF6\u7BB1\u300D\u300C\u4ED3\u5E93\u300D\u300C\u4E2A\u4EBA\u4ED3\u5E93\u300D\u8FD8\u662F\u300Cinbox\u300D\u90FD\u8BA4\u3002",
		  "manual.6.get.label": "\u53D6",
		  "manual.6.get.body": "\u63A5\u7740\u8BF4\u300C\u6253\u5F00\u7B2C 3 \u6761\u300D\uFF0C\u52A9\u624B\u5C31\u628A\u90A3\u6761\u62FF\u56DE\u6765\uFF1A\u6B63\u6587\uFF08\u6700\u591A 1000 \u5B57\uFF09\u3001\u94FE\u63A5\u3001\u5907\u6CE8\u3001\u6807\u7B7E\u3001\u9644\u4EF6\u4FE1\u606F\u3002",
		  "manual.6.refuse.label": "\u4E24\u6761\u786C\u62D2\u7EDD",
		  "manual.6.refuse.body": "\u8D26\u5BC6\u6C38\u4E0D\u56DE\u660E\u6587\uFF1B\u56FE\u7247\u9ED8\u8BA4\u53EA\u56DE\u4E00\u4E2A\u6807\u8BB0\uFF0C\u7531\u754C\u9762\u5728\u672C\u673A\u753B\u51FA\u6765\u3002\u60F3\u8BA9\u52A9\u624B\u4EB2\u773C\u770B\u56FE\uFF08\u6BD4\u5982\u300C\u8FD9\u5F20\u662F\u4EC0\u4E48\u7801\u300D\uFF09\uFF0C \u76F4\u63A5\u8BF4\u300C\u5E2E\u6211\u770B\u8FD9\u5F20\u56FE\u300D\u2014\u2014\u90A3\u4E00\u6B21\u624D\u4F1A\u628A\u8FD9\u5F20\u56FE\u53D1\u7ED9\u5B83\u3002",
		  "manual.6.tools.label": "\u52A9\u624B\u8BF4\u4E0D\u8BA4\u8BC6\u8FD9\u4E2A\u4ED3\u5E93",
		  "manual.6.tools.body": "\u8BF4\u660E\u8FD9\u4E2A\u4F1A\u8BDD\u6CA1\u5E26\u4E0A\u6536\u4EF6\u7BB1\u63D2\u4EF6\u3002\u65B0\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u95EE\u4E00\u6B21\u5373\u53EF\u2014\u2014\u9762\u677F\u80FD\u7528\u3001\u52A9\u624B\u770B\u4E0D\u5230\uFF0C \u8FD9\u4E24\u4EF6\u4E8B\u662F\u5206\u5F00\u7684\u3002",
		  "manual.7.title": "7. \u51FA\u95EE\u9898\u5148\u770B\u8FD9\u91CC",
		  "manual.7.title.label": "\u94FE\u63A5\u6CA1\u540D\u5B57",
		  "manual.7.title.body": "\u6B63\u5E38\uFF1A\u6709\u4E9B\u7AD9\u70B9\uFF08\u5982\u5FAE\u4FE1\uFF09\u5BF9\u975E\u6D4F\u89C8\u5668\u8BF7\u6C42\u53EA\u56DE\u7A7A\u58F3\u9875\uFF0C\u6293\u4E0D\u5230\u6807\u9898\uFF1B\u70B9\u8FDB\u8BE6\u60C5\u81EA\u5DF1\u8D77\u4E2A\u540D\u5B57\u5373\u53EF\u3002",
		  "manual.7.zero.label": "\u4E91\u76D8\u91CC\u6709 0 \u5B57\u8282\u76EE\u5F55",
		  "manual.7.zero.body": "\u4E91\u76D8\u81EA\u5DF1\u5EFA\u7684\u5360\u4F4D\u5BF9\u8C61\uFF0C\u4E0D\u662F\u63D2\u4EF6\u5199\u7684\uFF0C\u53EF\u4EE5\u5FFD\u7565\u3002",
		  "manual.7.sync.label": "\u540C\u6B65\u4E0D\u5BF9",
		  "manual.7.sync.body": "\u8BBE\u7F6E\u91CC\u70B9\u300C\u81EA\u68C0\u300D\uFF1A\u4F1A\u544A\u8BC9\u4F60\u901A\u9053\u901A\u4E0D\u901A\u3001\u54EA\u79CD\u7B7E\u540D\u53EF\u7528\uFF1B\u8BA4\u8BC1\u88AB\u62D2\u901A\u5E38\u662F\u300C\u5BA2\u6237\u7AEF\u6807\u8BC6\u300D\u4E0E AccessKey \u7ED1\u5B9A\u7684\u5E94\u7528\u4E0D\u4E00\u81F4\u3002"
		};
		var en = {
		  "heading.untitled": "(untitled)",
		  "heading.credential": "Credential",
		  "heading.tooltip": "{name} ({note})",
		  "kind.text": "Text",
		  "kind.link": "Link",
		  "kind.image": "Image",
		  "kind.file": "File",
		  "category.idea": "Idea/todo",
		  "category.article": "Article",
		  "category.media": "Video/audio",
		  "category.image": "Image",
		  "category.document": "ID document",
		  "category.secret": "Credential",
		  "category.other": "Other",
		  "source.rule": "by rule",
		  "source.model": "by model",
		  "source.user": "by you",
		  "source.rule.hint": "the local rules judged this from the shape of the link, text or image \u2014 no network was used",
		  "source.model.hint": "the rules could not decide, so the model did; what you say always wins and can be changed any time",
		  "source.user.hint": "the category you chose yourself \u2014 neither the rules nor the model will overwrite it",
		  "app.settings": "Settings",
		  "app.manual": "Manual",
		  "app.counts": " \xB7 {total} total \xB7 {watch} to read \xB7 {deleted} in the bin",
		  "app.refresh": "Sync",
		  "app.refreshing": "Syncing\u2026",
		  "app.loading": "Loading\u2026",
		  "app.saving": "Saving\u2026",
		  "app.filter": "Filter",
		  "app.store": "Save to vault",
		  "app.pickFile": "Choose a file",
		  "app.close": "Close",
		  "app.remove": "Remove {name}",
		  "app.prevPage": "Previous",
		  "app.nextPage": "Next",
		  "pager.of": "page {page} / {pages}",
		  "app.category": "Category",
		  "app.tag": "Tag",
		  "app.emptyBox": "Nothing to save yet: paste some text or a link, or drop an image in",
		  "app.detail": "Record",
		  "app.noMatches": "Nothing matches.",
		  "app.binEmpty": "The bin is empty.",
		  "app.matches": "{count} matching",
		  "app.attachments": "{count} attachment(s)",
		  "app.failedCount": "{count} failed",
		  "app.pickOne": "Pick a record on the left to see it here.",
		  "app.unnamedFile": "(unnamed)",
		  "capture.placeholder": "Paste text or a link, or drop an image/file here (Ctrl+Enter to save)",
		  "search.placeholder": "Search title, text, link, note\u2026",
		  "modes.label": "List density",
		  "modes.titleOf": "List density: {label}",
		  "modes.grid": "Grid",
		  "modes.compact": "Compact",
		  "filter.all": "All",
		  "filter.watch": "To read",
		  "filter.bin": "Bin",
		  "filter.clearBin": "Empty the bin",
		  "filter.untagAll": "Remove the tag \u201C{tag}\u201D from every record (the records stay)",
		  "detail.name": "Name",
		  "detail.nameTitle": "The name the list, the cards and the conversation show; empty falls back to the file name or the note",
		  "detail.namePlaceholder": "Name, e.g. ID card front (empty falls back to the file name)",
		  "detail.note": "Note",
		  "detail.noteTitle": "What you write always outranks what the model guessed",
		  "detail.notePlaceholder": "Note, e.g. ID photo / video to watch / this key is for staging (when there is no name, it becomes the row\u2019s name)",
		  "detail.tagsPlaceholder": "Tags, e.g. frontend, expenses (comma separated)",
		  "detail.save": "Save",
		  "detail.watch": "Mark to read",
		  "detail.unwatch": "Unmark",
		  "detail.restore": "Restore",
		  "detail.delete": "Delete",
		  "detail.removeTag": "Remove \u201C{tag}\u201D from this record",
		  "detail.updated": " \xB7 updated {when}",
		  "detail.sealedNote": "This body is ciphertext and cannot be read. Unlock it under Settings \u2192 Credential encryption; if the parameters that open it have not arrived yet (the record came over sync), hit Sync once.",
		  "detail.play": "Play",
		  "detail.zoom": "Zoom in",
		  "detail.playInBrowser": "Play in the browser",
		  "detail.openInBrowser": "Open in the browser",
		  "detail.zoomInPanel": "Zoom in here",
		  "detail.foreign": "This one lives on another site",
		  "detail.foreignBody": "the panel does not embed other people\u2019s players, so open it in the browser \u2014 that is where the big screen is.",
		  "settings.secrets": "Credential encryption",
		  "settings.secretsBody": "Credential bodies are stored encrypted. The key is never written down: every restart locks the vault again, and a forgotten password cannot be recovered.",
		  "settings.lockedBody": "Enter the master password to unlock; the key is never written down, so every restart asks again.",
		  "settings.unlockedBody": "Credentials can be read and written until this process restarts.",
		  "settings.otherPassword": "{count} more cannot be opened: they were sealed with another master password \u2014 enter that one.",
		  "settings.otherPasswordNoParams": "{count} more cannot be opened: they came from another machine \u2014 hit Sync once to bring its parameters over.",
		  "settings.masterPassword": "Master password",
		  "settings.masterPasswordSet": "Enter the master password",
		  "settings.masterPasswordNew": "Set a master password",
		  "settings.unlock": "Unlock",
		  "settings.lock": "Lock",
		  "settings.setOrChange": "Set / Change",
		  "settings.unlocked": "Unlocked",
		  "settings.locked": "Locked",
		  "settings.lockedNote": "Locked: credential bodies stay unreadable until you unlock again",
		  "settings.noPassword": "No master password yet",
		  "settings.sealedNoParams": "{count} sealed records, unlocking parameters not here yet",
		  "settings.sealedNoParamsBody": "Hit Sync once to pull them over, then enter the master password from the machine that sealed them.",
		  "settings.passwordJustSet": "Master password set \u2014 credentials are now encrypted at rest",
		  "settings.passwordSealed": "Master password set, and {count} old records went from plain text to ciphertext",
		  "settings.ingest": "Drop folder",
		  "settings.ingestOnly": "One way only: other devices drop files there, this machine pulls them in. The password lives in dsh\u2019s credential store, not in the config.",
		  "settings.protocol": "Protocol",
		  "settings.protocolHint": "save after switching protocol",
		  "settings.endpoint": "Endpoint",
		  "settings.endpointPlaceholder": "s3.cstcloud.cn (https assumed)",
		  "settings.region": "Region",
		  "settings.bucketAddress": "Address",
		  "settings.bucketDir": "Directory",
		  "settings.adoptForeign": "Merge other sync directories too",
		  "settings.adoptForeignHint": "(brings back records a machine left under an older directory; off by default)",
		  "settings.directoryPlaceholder": "inbox (the default \u2014 blank or / means the same)",
		  "settings.dirS3.lead": "the directory is also the key prefix for S3 (default ",
		  "settings.dirS3.mid": ", which becomes ",
		  "settings.dirS3.tail": ").",
		  "settings.clientId": "Client identity",
		  "settings.clientIdS3": "empty means dsh-inbox; some gateways identify callers by it \u2014 use the application this AccessKey is bound to",
		  "settings.clientIdWebdav": "empty means dsh-inbox; some gateways identify callers by it \u2014 use the application this WebDAV account is bound to",
		  "settings.username": "Username",
		  "settings.password": "Password",
		  "settings.passwordStored": "stored (leave empty to keep it)",
		  "settings.passwordStore": "kept in dsh\u2019s credential store",
		  "settings.signature": "Signature",
		  "settings.signatureV2": "v2 (what older gateways usually want)",
		  "settings.save": "Save",
		  "settings.probe": "Test",
		  "settings.details": "Details ({count} requests)",
		  "settings.syncRootNow": "sync root: {root}",
		  "settings.noServiceBody": "this composition has no settings service, so the address cannot be changed \u2014 you are most likely running the headless shape.",
		  "settings.bucketHint": "other devices drop things here",
		  "notice.listFailed": "Could not read the list: {reason}",
		  "notice.listUnreadable": "Could not read the list: the host answered with something we cannot read",
		  "notice.detailFailed": "Could not read the record: {reason}",
		  "notice.responseUnreadable": "The host answered with something we cannot read (HTTP {status})",
		  "notice.listModeUnsaved": "The list layout was not remembered: {reason}",
		  "notice.captureEmpty": "Nothing to save yet: paste some text or a link, or drop an image in",
		  "notice.captureFailed": "Not saved: {reason}",
		  "notice.saved": "Saved {count}",
		  "notice.merged": "Merged {count} duplicate(s)",
		  "notice.restored": "Restored {count} from the bin",
		  "notice.settingsSaved": "Settings saved",
		  "notice.settingsUnreadable": "Could not read the settings: {reason}",
		  "notice.settingsFailed": "Not saved: {reason}",
		  "notice.probeFailed": "Test failed: {reason}",
		  "notice.probeDone": "The test result is below",
		  "notice.syncing": "Syncing\u2026",
		  "notice.pushFailed": "Push failed: {reason}",
		  "notice.pullFailed": "Pull failed: {reason}",
		  "notice.tagRemoved": "Tag \u201C{tag}\u201D removed",
		  "notice.tagRemoveFailed": "Could not remove the tag: {reason}",
		  "notice.purgeFailed": "Could not empty the bin: {reason}",
		  "notice.purgeNoRemote": " (no remote configured)",
		  "notice.purgeRemote": ", {count} object(s) deleted in the cloud",
		  "notice.purgeDone": "Emptied {count}{remote}{failure}",
		  "notice.purgeFailedAtRemote": " \xB7 the cloud had failures: {reason}",
		  "confirm.untag": "Remove the tag \u201C{tag}\u201D from {count} record(s)? The records themselves stay.",
		  "confirm.purge": "Emptying the bin really deletes these records: the local ones and the matching objects in the cloud (record JSON/text, plus any attachment only they referenced). It cannot be undone. The original bytes in dsh\u2019s attachment store stay. Continue?",
		  "sync.pushUnconfigured": "Push: no remote configured yet",
		  "sync.pushFailed": "Push failed: {reason}",
		  "sync.pushUnknown": "unknown reason",
		  "sync.pushPartial": "{head} \xB7 partly failed: {reason}",
		  "sync.pullNoAddress": "No address configured yet",
		  "sync.pullFailed": "Pull failed: {reason}",
		  "sync.detailPushedIdle": "pushed 0 (nothing new)",
		  "sync.detailPushed": "pushed {records} / {attachments} attachments",
		  "sync.detailPulled": "pulled {count} \xB7 the cloud holds {records} records / {files} attachments",
		  "sync.detailAdded": " ({count} of them new)",
		  "sync.detailDeleted": " ({count} of them deletions \u2014 they land in the recycle bin)",
		  "sync.detailPurged": " ({count} emptied out of the bin: their older cloud copies stayed out)",
		  "sync.pullForeignSync": " \xB7 \u26A0\uFE0F {records} records live in another sync directory: {roots}",
		  "sync.detailForeign": " \xB7 \u26A0\uFE0F another sync directory: {roots} ({records} records; ours is {ours})",
		  "sync.shortPushed": "pushed {count}",
		  "sync.shortPulled": "pulled {count}",
		  "sync.shortIdle": "up to date",
		  "sync.pullFailures": " \xB7 {count} failed: {reason}",
		  "settings.status": "{settings} \xB7 {webdav} \xB7 {s3}",
		  "settings.statusOn": "settings service present",
		  "settings.statusOff": "no settings service",
		  "settings.statusWebdavSet": "WebDAV password stored",
		  "settings.statusWebdavUnset": "no WebDAV password yet",
		  "settings.statusS3Set": "S3 secret stored",
		  "settings.statusS3Unset": "no S3 secret yet",
		  "card.openThis": "Open this in \u4ED3\u5E93 on the right",
		  "card.searchTitle": "\u{1F5C2} dsh-inbox \xB7 vault search",
		  "card.getTitle": "\u{1F5C2} dsh-inbox \xB7 record",
		  "card.error": " \xB7 failed",
		  "card.open": "Open",
		  "card.pending": "(this call has no result yet)",
		  "dock.title": "Vault",
		  "dock.description": "The inbox, next to the conversation",
		  "dock.recent": "Latest {count}",
		  "dock.watch": " \xB7 to read",
		  "dock.back": "Back to the latest",
		  "dock.backShort": "Back",
		  "dock.note": "Note: ",
		  "dock.unavailable": "Could not read the vault \u2014 look at the \u201C{panel}\u201D panel on the left.",
		  "dock.hint": "This is just a glance. Change the category, delete records or set up the drop folder in the \u201C{panel}\u201D panel on the left.",
		  "dock.gone": "Could not read this record; it may have been deleted.",
		  "dock.editHint": "Changing the category, the note or deleting all happen in the \u201C{panel}\u201D panel on the left.",
		  "manual.title": "Manual",
		  "manual.titleInline": "How to use dsh-inbox",
		  "manual.lead": "a three-minute read",
		  "manual.separator": ": ",
		  "manual.1.title": "1. Getting things in",
		  "manual.1.panel.label": "Panel",
		  "manual.1.panel.body": "Paste text or a link, drop in images or files, or press \u201CChoose a file\u2026\u201D and then \u201CSave to vault\u201D (Ctrl+Enter works too).",
		  "manual.1.chat.label": "In the conversation",
		  "manual.1.chat.lead": "type ",
		  "manual.1.chat.code": "/inbox text or a link",
		  "manual.1.chat.tail": ", attach images straight onto the composer; nothing is sent to the model.",
		  "manual.1.repeat.label": "Repeats",
		  "manual.1.repeat.body": "Saving the same thing twice does not add a row \u2014 it joins the record it already has, and pulls it out of the bin if that is where it was.",
		  "manual.2.title": "2. Browsing and editing",
		  "manual.2.filter.label": "Filters",
		  "manual.2.filter.body": "\u201CAll / To read / Bin\u201D on the left exclude categories and tags; \u201CTo read\u201D is your own flag, and new records carry none.",
		  "manual.2.list.label": "List",
		  "manual.2.list.body": "Two densities (grid / compact) switch with a click and are remembered; the search box covers title, text, link and note.",
		  "manual.2.detail.label": "Record",
		  "manual.2.detail.body": "The right-hand pane edits the name, category, note and tags, and can flag, delete or restore.",
		  "manual.3.title": "3. Where a row\u2019s name comes from",
		  "manual.3.order.label": "Order",
		  "manual.3.order.body": "the name you typed \u2192 the fetched page title \u2192 the link/text/file name \u2192 the note (the last resort).",
		  "manual.3.icon.label": "Glyphs",
		  "manual.3.icon.tail": " each have their own glyph; a credential is a key, recognisable at a glance.",
		  "manual.3.who.label": "Who judged it",
		  "manual.3.who.lead": "the badge beside the category comes in three kinds: ",
		  "manual.3.who.tail": " (a category you chose is never overwritten by rules or the model).",
		  "manual.4.title": "4. Credentials",
		  "manual.4.password.label": "Set a master password first",
		  "manual.4.password.body": "Settings \u2192 Credential encryption. Once set, credential bodies are ciphertext on disk; without one they are refused (better not to store it than to store it in the clear).",
		  "manual.4.unlock.label": "Every restart locks it",
		  "manual.4.unlock.body": "neither the password nor its key is written down, so a restart needs one unlock in the same place; a forgotten password cannot be recovered.",
		  "manual.4.never.label": "Never shown",
		  "manual.4.never.body": "the list shows only the name you gave it; a conversation gets a one-line refusal; classification requests are redacted first.",
		  "manual.5.title": "5. Sync (this machine \u2194 the cloud)",
		  "manual.5.auto.label": "Automatic",
		  "manual.5.auto.body": "a few seconds after a capture or an edit a push goes out (debounced \u2014 five quick saves push once).",
		  "manual.5.manual.label": "Manual",
		  "manual.5.manual.body": "\u201CRefresh\u201D in the top right is a full sync: push local changes, pull the others, then re-read the list.",
		  "manual.5.twoMachines.label": "Two machines",
		  "manual.5.twoMachines.body": "Both machines need the same \u300C\u76EE\u5F55\u300D (blank, / and inbox all mean the same directory). While they differ nothing crosses over by default: the refresh says \u201CN records live in another sync directory\u201D, and either matching them or ticking \u201CMerge other sync directories too\u201D brings them in.",
		  "manual.5.delete.label": "Deleting",
		  "manual.5.delete.body": "\u201CDelete\u201D in the panel only moves a record to the bin (other devices learn it is gone instead of pushing it back); emptying the bin is the real delete, and the cloud copy goes with it.",
		  "manual.5.merge.label": "Merging",
		  "manual.5.merge.body": "Incoming records merge by id + timestamp: the newer write wins, no conflict copies.",
		  "manual.5.cloud.label": "What goes up",
		  "manual.5.cloud.body": "Records and attachments both travel; only credential bodies are ciphertext \u2014 text, links, notes and attachments are plain text, so the bucket needs access control.",
		  "manual.6.title": "6. Getting things back in the conversation",
		  "manual.6.query.label": "Ask",
		  "manual.6.query.body": "just ask: \u201Cwhich links in my inbox haven\u2019t I read yet?\u201D The assistant searches the vault, lists at most 10, and tells you how many are left. \u6536\u4EF6\u7BB1 / \u4ED3\u5E93 / inbox all mean the same shelf.",
		  "manual.6.get.label": "Fetch",
		  "manual.6.get.body": "then say \u201Copen number 3\u201D and it comes back: text (up to 1000 characters), link, note, tags and attachment facts.",
		  "manual.6.refuse.label": "Two hard refusals",
		  "manual.6.refuse.body": "a credential never comes back in clear text, and an image comes back as a marker the UI draws locally. To have the assistant look at a picture (say, \u201Cwhat is this code?\u201D), ask it to \u2014 that one call sends that one image.",
		  "manual.6.tools.label": "The assistant says it does not know this vault",
		  "manual.6.tools.body": "this session was not started with the inbox plugin. Open a new session and ask again \u2014 the panel working and the assistant seeing the tools are two different things.",
		  "manual.7.title": "7. When something looks wrong",
		  "manual.7.title.label": "A link has no name",
		  "manual.7.title.body": "normal: some sites (WeChat among them) serve non-browser requests an empty shell page with no title. Open the record and name it yourself.",
		  "manual.7.zero.label": "A 0-byte directory in the cloud",
		  "manual.7.zero.body": "a placeholder the cloud drive made itself, not something the plugin wrote \u2014 ignore it.",
		  "manual.7.sync.label": "Sync looks wrong",
		  "manual.7.sync.body": "press \u201CTest\u201D in Settings: it says whether the channel works and which signature shape is accepted. An authentication refusal usually means the client identity does not match the application the AccessKey is bound to."
		};
		var MESSAGES = { zh, en };
		
		// src/client/i18n.ts
		var MESSAGES_NS = "dsh-inbox";
		var service;
		var bound;
		var observed;
		var revision = 0;
		var listeners = /* @__PURE__ */ new Set();
		function notify() {
		  revision += 1;
		  for (const listener of listeners) listener();
		}
		function subscribeToLocale(listener) {
		  listeners.add(listener);
		  return () => {
		    listeners.delete(listener);
		  };
		}
		function localeRevision() {
		  return revision;
		}
		function useLocaleRevision() {
		  return (0, import_react4.useSyncExternalStore)(subscribeToLocale, localeRevision, localeRevision);
		}
		function resolveLanguage(tag) {
		  return tag !== void 0 && tag.toLowerCase().startsWith("zh") ? "zh" : "en";
		}
		function documentLanguage() {
		  if (typeof document === "undefined") return void 0;
		  const tag = document.documentElement?.getAttribute("lang");
		  return typeof tag === "string" && tag.length > 0 ? tag : void 0;
		}
		function browserLanguage() {
		  if (typeof navigator === "undefined") return void 0;
		  const preferred = navigator.languages?.[0] ?? navigator.language;
		  return typeof preferred === "string" && preferred.length > 0 ? preferred : void 0;
		}
		function activeLanguage() {
		  return resolveLanguage(observed ?? documentLanguage() ?? browserLanguage());
		}
		function fill(text, params) {
		  return text.replace(
		    /\{(\w+)\}/g,
		    (whole, name2) => name2 in params ? String(params[name2]) : whole
		  );
		}
		function t(key, params) {
		  const text = bound?.(key) ?? MESSAGES[activeLanguage()][key] ?? MESSAGES.en[key] ?? key;
		  return params === void 0 ? text : fill(text, params);
		}
		function kindLabel(kind) {
		  return t(`kind.${kind}`);
		}
		function categoryLabel(category) {
		  return t(`category.${category}`);
		}
		function sourceLabel(source) {
		  return t(`source.${source}`);
		}
		function sourceHint(source) {
		  return t(`source.${source}.hint`);
		}
		function observeDocument() {
		  observed = documentLanguage();
		  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return () => {
		  };
		  const observer = new MutationObserver(() => {
		    const next = documentLanguage();
		    if (next === observed) return;
		    observed = next;
		    notify();
		  });
		  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
		  return () => {
		    observer.disconnect();
		  };
		}
		function installLocale(ctx) {
		  const locale = ctx.get("locale");
		  if (locale === void 0) {
		    ctx.effect(() => observeDocument(), "dsh-inbox: follow <html lang>");
		    return;
		  }
		  service = locale;
		  ctx.effect(() => locale.register(MESSAGES_NS, "zh", MESSAGES.zh), "dsh-inbox: zh dictionary");
		  ctx.effect(() => locale.register(MESSAGES_NS, "en", MESSAGES.en), "dsh-inbox: en dictionary");
		  bound = locale.bind(MESSAGES_NS);
		  observed = locale.getSnapshot().active;
		  ctx.effect(
		    () => locale.subscribe(() => {
		      observed = locale.getSnapshot().active;
		      notify();
		    }),
		    "dsh-inbox: language changes"
		  );
		}
		
		// src/client/heading.ts
		var NOTE_IN_HEADING_CHARS = 24;
		function isSecret(entry) {
		  return entry.category === "secret";
		}
		function firstFilled(...values) {
		  return values.find((value) => value !== void 0 && value.trim().length > 0);
		}
		function noteLine(note, chars) {
		  const collapsed = (note ?? "").replace(/\s+/g, " ").trim();
		  if (collapsed.length === 0) return "";
		  return collapsed.length <= chars ? collapsed : `${collapsed.slice(0, chars)}\u2026`;
		}
		function ownName(entry) {
		  if (isSecret(entry)) return void 0;
		  return firstFilled(entry.linkTitle, entry.url, entry.preview, entry.attachmentName);
		}
		function build(entry, noteChars) {
		  const title = firstFilled(entry.title);
		  if (title !== void 0) return title;
		  const own = ownName(entry);
		  if (own !== void 0) return own;
		  return noteLine(entry.note, noteChars) || (isSecret(entry) ? t("heading.credential") : t("heading.untitled"));
		}
		function headingOf(entry) {
		  return build(entry, NOTE_IN_HEADING_CHARS);
		}
		function headingTooltipOf(entry) {
		  const name2 = build(entry, Number.MAX_SAFE_INTEGER);
		  const note = noteLine(entry.note, Number.MAX_SAFE_INTEGER);
		  return note.length === 0 || note === name2 ? name2 : t("heading.tooltip", { name: name2, note });
		}
		
		// src/client/dock.tsx
		var import_jsx_runtime = require("react/jsx-runtime");
		var DOCK_KIND = "inbox-vault";
		var DOCK_TAB_ID = PACKAGE_NAME;
		var DOCK_LIMIT = 12;
		var openVaultDock;
		function dockFocusOf(info) {
		  const navigation = info?.tab?.navigation;
		  const wanted = navigation?.params?.id;
		  const revision2 = navigation?.revision;
		  return {
		    ...typeof wanted === "string" && wanted.length > 0 ? { id: wanted } : {},
		    revision: typeof revision2 === "number" ? revision2 : 0
		  };
		}
		function registerInboxDock(ctx) {
		  ctx.inject(["sidebarRightTabs"], (scoped) => {
		    const slots = scoped.get("slots");
		    const tabs = scoped.get("sidebarRightTabs");
		    if (slots === void 0 || tabs === void 0) return;
		    try {
		      tabs.register({
		        id: DOCK_TAB_ID,
		        kind: DOCK_KIND,
		        title: () => t("dock.title"),
		        guide: [
		          { order: 20, title: () => t("dock.title"), description: () => t("dock.description") }
		        ]
		      });
		      slots.inject(
		        "sidebar.right.pane.tab",
		        () => slots.register({ name: "sidebar.right.pane.tab", key: DOCK_TAB_ID }, InboxDock)
		      );
		      const controller = scoped.get("sidebarRight");
		      openVaultDock = (id) => {
		        controller?.openTab?.(
		          DOCK_KIND,
		          id === void 0 ? void 0 : { params: { id }, revealIfOpened: true }
		        );
		      };
		    } catch {
		    }
		  });
		}
		function InboxDock(props) {
		  useLocaleRevision();
		  const info = (props?.useTabInfo ?? props?.hooks?.tabInfo)?.();
		  const { id: focused, revision: revision2 } = dockFocusOf(info);
		  return focused === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockList, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockRecord, { id: focused, revision: revision2 });
		}
		function DockList() {
		  const [entries, setEntries] = import_react5.default.useState();
		  const [failed, setFailed] = import_react5.default.useState(false);
		  import_react5.default.useEffect(() => {
		    let live = true;
		    void (async () => {
		      try {
		        const response = await fetch(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_LIST}`, {
		          method: "POST",
		          headers: { "content-type": "application/json" },
		          body: JSON.stringify({ limit: DOCK_LIMIT })
		        });
		        const answer = await response.json();
		        if (!live) return;
		        if (answer.ok) setEntries(answer.value.entries);
		        else setFailed(true);
		      } catch {
		        if (live) setFailed(true);
		      }
		    })();
		    return () => {
		      live = false;
		    };
		  }, []);
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "10px 12px", fontSize: 13 }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0.6, marginBottom: 8 }, children: entries === void 0 ? t("app.loading") : t("dock.recent", { count: entries.length }) }),
		    failed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.7 }, children: t("dock.unavailable", { panel: "Inbox" }) }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }, children: entries?.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
		      "li",
		      {
		        style: {
		          border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
		          borderRadius: 8,
		          padding: "6px 8px",
		          opacity: 1
		        },
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { overflowWrap: "anywhere" }, children: headingOf(entry) }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, opacity: 0.6, marginTop: 2 }, children: [
		            kindLabel(entry.kind),
		            " \xB7 ",
		            categoryLabel(entry.category),
		            entry.watchLater ? t("dock.watch") : ""
		          ] })
		        ]
		      },
		      entry.id
		    )) }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.6, marginTop: 10 }, children: t("dock.hint", { panel: "Inbox" }) })
		  ] });
		}
		function DockRecord({ id, revision: revision2 }) {
		  const [entry, setEntry] = import_react5.default.useState();
		  const [failed, setFailed] = import_react5.default.useState(false);
		  import_react5.default.useEffect(() => {
		    let live = true;
		    setEntry(void 0);
		    setFailed(false);
		    void (async () => {
		      try {
		        const response = await fetch(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_DETAIL}`, {
		          method: "POST",
		          headers: { "content-type": "application/json" },
		          body: JSON.stringify({ id })
		        });
		        const answer = await response.json();
		        if (!live) return;
		        if (answer.ok) setEntry(answer.value.entry);
		        else setFailed(true);
		      } catch {
		        if (live) setFailed(true);
		      }
		    })();
		    return () => {
		      live = false;
		    };
		  }, [id, revision2]);
		  const clause = { margin: "6px 0 0", overflowWrap: "anywhere" };
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "10px 12px", fontSize: 13 }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: t("dock.title") }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		        "button",
		        {
		          type: "button",
		          onClick: () => openVaultDock?.(),
		          title: t("dock.back"),
		          style: {
		            marginLeft: "auto",
		            font: "inherit",
		            fontSize: 12,
		            padding: "2px 8px",
		            borderRadius: 999,
		            border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
		            background: "transparent",
		            color: "inherit",
		            cursor: "pointer"
		          },
		          children: t("dock.backShort")
		        }
		      )
		    ] }),
		    failed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.7 }, children: t("dock.gone") }),
		    entry === void 0 && !failed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.6 }, children: t("app.loading") }),
		    entry !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { overflowWrap: "anywhere", fontWeight: 500 }, children: headingOf(entry) }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, opacity: 0.6, marginTop: 2 }, children: [
		        kindLabel(entry.kind),
		        " \xB7 ",
		        categoryLabel(entry.category),
		        entry.watchLater ? t("dock.watch") : "",
		        ` \xB7 ${new Date(entry.createdAt).toLocaleString()}`
		      ] }),
		      entry.note !== void 0 && entry.note.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: clause, children: [
		        t("dock.note"),
		        entry.note
		      ] }),
		      entry.url !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: clause, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: entry.url, target: "_blank", rel: "noreferrer", children: entry.url }) }),
		      entry.attachments.map((attachment) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 8 }, children: attachment.image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		        "img",
		        {
		          src: `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(attachment.id)}`,
		          alt: attachment.filename ?? "",
		          style: { maxWidth: "100%", borderRadius: 6, display: "block" }
		        }
		      ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { opacity: 0.7 }, children: [
		        "\u{1F4C4} ",
		        attachment.filename ?? attachment.mime,
		        ` \xB7 ${String(Math.round(attachment.bytes / 1024))} KB`
		      ] }) }, attachment.id)),
		      entry.text !== void 0 && entry.text.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		        "pre",
		        {
		          style: {
		            margin: "10px 0 0",
		            padding: 8,
		            maxHeight: 260,
		            overflow: "auto",
		            borderRadius: 8,
		            border: "1px solid color-mix(in srgb, currentColor 15%, transparent)",
		            font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
		            whiteSpace: "pre-wrap"
		          },
		          children: entry.text
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.6, marginTop: 10 }, children: t("dock.editHint", { panel: "Inbox" }) })
		    ] })
		  ] });
		}
		
		// src/client/card.tsx
		var import_jsx_runtime2 = require("react/jsx-runtime");
		var MARKER = /\[attachment:([A-Za-z0-9_-]+)\]/g;
		var URL_PATTERN = /(https?:\/\/[^\s<>()]+)/g;
		var RECORD_ID = /id: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
		function resultText(block) {
		  if (typeof block.text === "string" && block.text.length > 0) return block.text;
		  if (!Array.isArray(block.content)) return void 0;
		  const parts = [];
		  for (const part of block.content) {
		    if (typeof part !== "object" || part === null) continue;
		    const candidate = part;
		    if (candidate.type === "text" && typeof candidate.text === "string") parts.push(candidate.text);
		  }
		  return parts.length === 0 ? void 0 : parts.join("\n");
		}
		function RecordLink({ id }) {
		  if (openVaultDock === void 0) return null;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		    "button",
		    {
		      type: "button",
		      title: t("card.openThis"),
		      onClick: () => openVaultDock?.(id),
		      style: {
		        font: "inherit",
		        marginLeft: 6,
		        padding: "0 8px",
		        borderRadius: 999,
		        border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
		        background: "color-mix(in srgb, currentColor 8%, transparent)",
		        color: "inherit",
		        cursor: "pointer"
		      },
		      children: [
		        t("card.open"),
		        " \u2197"
		      ]
		    }
		  );
		}
		function withLinks(text, keyPrefix) {
		  const nodes = [];
		  let last = 0;
		  let match;
		  for (const chunk of splitOnRecordIds(text, keyPrefix)) {
		    if (typeof chunk !== "string") {
		      nodes.push(chunk);
		      continue;
		    }
		    URL_PATTERN.lastIndex = 0;
		    last = 0;
		    while ((match = URL_PATTERN.exec(chunk)) !== null) {
		      if (match.index > last) nodes.push(chunk.slice(last, match.index));
		      const url = match[0];
		      nodes.push(
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: url, target: "_blank", rel: "noreferrer", children: url }, `${keyPrefix}-${String(match.index)}`)
		      );
		      last = match.index + url.length;
		    }
		    if (last < chunk.length) nodes.push(chunk.slice(last));
		  }
		  return nodes;
		}
		function splitOnRecordIds(text, keyPrefix) {
		  const parts = [];
		  let last = 0;
		  RECORD_ID.lastIndex = 0;
		  let match;
		  while ((match = RECORD_ID.exec(text)) !== null) {
		    if (match.index > last) parts.push(text.slice(last, match.index));
		    const id = match[1];
		    parts.push(
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { opacity: 0.55, fontSize: 12 }, children: [
		        "id: ",
		        id
		      ] }, `${keyPrefix}-r${String(match.index)}`),
		      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RecordLink, { id: id ?? "" }, `${keyPrefix}-open${String(match.index)}`)
		    );
		    last = match.index + match[0].length;
		  }
		  if (last < text.length) parts.push(text.slice(last));
		  return parts;
		}
		function Thumbnail({ id }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "img",
		    {
		      src: `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(id)}`,
		      alt: "",
		      style: {
		        maxWidth: 220,
		        maxHeight: 220,
		        borderRadius: 6,
		        display: "block",
		        margin: "6px 0"
		      }
		    }
		  );
		}
		function render(text) {
		  const nodes = [];
		  let last = 0;
		  let match;
		  MARKER.lastIndex = 0;
		  while ((match = MARKER.exec(text)) !== null) {
		    const before = text.slice(last, match.index);
		    if (before.length > 0) nodes.push(...withLinks(before, `t${String(last)}`));
		    const id = match[1];
		    if (id !== void 0) nodes.push(/* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Thumbnail, { id }, `a-${id}`));
		    last = match.index + match[0].length;
		  }
		  const tail = text.slice(last);
		  if (tail.length > 0) nodes.push(...withLinks(tail, `t${String(last)}`));
		  return nodes;
		}
		function InboxToolCard({ toolName, block }) {
		  useLocaleRevision();
		  const text = resultText(block);
		  const isError = block.isError === true;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		    "div",
		    {
		      style: {
		        border: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
		        borderRadius: 10,
		        padding: "10px 12px",
		        font: "13px/1.6 system-ui, sans-serif",
		        overflowWrap: "anywhere"
		      },
		      children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { opacity: 0.65, marginBottom: 6 }, children: [
		          toolName === "inbox_search" ? t("card.searchTitle") : t("card.getTitle"),
		          isError ? t("card.error") : ""
		        ] }),
		        text === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { opacity: 0.6 }, children: t("card.pending") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: render(text) })
		      ]
		    }
		  );
		}
		function registerToolCards(slots) {
		  for (const key of ["inbox_search", "inbox_get"]) {
		    slots.inject(
		      "tool.call.toolview",
		      () => slots.register({ name: "tool.call.toolview", key }, InboxToolCard)
		    );
		  }
		}
		
		// src/client/manual.tsx
		var import_react7 = require("react");
		
		// src/shared/vocabulary.ts
		var CATEGORIES = [
		  "idea",
		  "article",
		  "media",
		  "image",
		  "document",
		  "secret",
		  "other"
		];
		var CATEGORY_SOURCES = ["rule", "model", "user"];
		
		// src/client/manual.tsx
		var import_jsx_runtime3 = require("react/jsx-runtime");
		function Section({
		  title,
		  children
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: title }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 2, opacity: 0.85 }, children })
		  ] });
		}
		function Line({ label, children }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { style: { margin: 0 }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { style: { fontWeight: 600 }, children: label }),
		    label.length === 0 ? "" : t("manual.separator"),
		    children
		  ] });
		}
		function ManualDialog({ onClose }) {
		  useLocaleRevision();
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		    "div",
		    {
		      role: "dialog",
		      "aria-label": t("manual.title"),
		      style: {
		        position: "fixed",
		        inset: 0,
		        zIndex: 45,
		        background: "color-mix(in srgb, #000 55%, transparent)",
		        display: "flex",
		        alignItems: "center",
		        justifyContent: "center",
		        padding: "4vh 16px"
		      },
		      onClick: (event) => {
		        if (event.target === event.currentTarget) onClose();
		      },
		      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		        "div",
		        {
		          style: {
		            /*
		              A fixed width and a bounded height, with the *sections* scrolling.
		              The first version let the card grow as tall as its content and put
		              the scroll on the backdrop instead — which on a laptop meant the
		              manual ran off the bottom of the screen with no visible frame.
		            */
		            width: "min(560px, 100%)",
		            /*
		              80vh rather than 92vh: at 92 the card still felt like a full screen
		              and it pushed the panel out of sight, while the point of the manual
		              is to be readable *beside* what it explains (asked 2026-09-21).
		            */
		            maxHeight: "80vh",
		            // Border inside the width and the cap: without it the card is 2px
		            // wider than the number and 2px taller than the overlay's room.
		            boxSizing: "border-box",
		            background: "Canvas",
		            color: "CanvasText",
		            border: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
		            borderRadius: 12,
		            display: "flex",
		            flexDirection: "column",
		            boxShadow: "0 18px 40px #0007",
		            overflow: "hidden"
		          },
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		              "div",
		              {
		                style: {
		                  display: "flex",
		                  alignItems: "baseline",
		                  gap: 8,
		                  padding: "14px 18px 12px",
		                  borderBottom: "1px solid color-mix(in srgb, currentColor 12%, transparent)"
		                },
		                children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { style: { fontSize: 16 }, children: t("manual.titleInline") }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.6, fontSize: 12 }, children: t("manual.lead") }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		                    "button",
		                    {
		                      type: "button",
		                      onClick: onClose,
		                      style: {
		                        marginLeft: "auto",
		                        font: "inherit",
		                        padding: "4px 10px",
		                        borderRadius: 8,
		                        border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
		                        background: "transparent",
		                        color: "inherit",
		                        cursor: "pointer"
		                      },
		                      children: t("app.close")
		                    }
		                  )
		                ]
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		              "div",
		              {
		                className: "dsh-inbox-scroll",
		                style: {
		                  padding: 18,
		                  display: "flex",
		                  flexDirection: "column",
		                  gap: 14,
		                  overflowY: "auto",
		                  minHeight: 0
		                },
		                children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: t("manual.1.title"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.1.panel.label"), children: t("manual.1.panel.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Line, { label: t("manual.1.chat.label"), children: [
		                      t("manual.1.chat.lead"),
		                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { children: t("manual.1.chat.code") }),
		                      t("manual.1.chat.tail")
		                    ] }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.1.repeat.label"), children: t("manual.1.repeat.body") })
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: t("manual.2.title"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.2.filter.label"), children: t("manual.2.filter.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.2.list.label"), children: t("manual.2.list.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.2.detail.label"), children: t("manual.2.detail.body") })
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: t("manual.3.title"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.3.order.label"), children: t("manual.3.order.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Line, { label: t("manual.3.icon.label"), children: [
		                      CATEGORIES.map((category) => categoryLabel(category)).join(" / "),
		                      t("manual.3.icon.tail")
		                    ] }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Line, { label: t("manual.3.who.label"), children: [
		                      t("manual.3.who.lead"),
		                      CATEGORY_SOURCES.map((source) => sourceLabel(source)).join(" / "),
		                      t("manual.3.who.tail")
		                    ] })
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: t("manual.4.title"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.4.password.label"), children: t("manual.4.password.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.4.unlock.label"), children: t("manual.4.unlock.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.4.never.label"), children: t("manual.4.never.body") })
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: t("manual.5.title"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.5.auto.label"), children: t("manual.5.auto.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.5.manual.label"), children: t("manual.5.manual.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.5.merge.label"), children: t("manual.5.merge.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.5.twoMachines.label"), children: t("manual.5.twoMachines.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.5.cloud.label"), children: t("manual.5.cloud.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.5.delete.label"), children: t("manual.5.delete.body") })
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: t("manual.6.title"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.6.query.label"), children: t("manual.6.query.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.6.get.label"), children: t("manual.6.get.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.6.refuse.label"), children: t("manual.6.refuse.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.6.tools.label"), children: t("manual.6.tools.body") })
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: t("manual.7.title"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.7.title.label"), children: t("manual.7.title.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.7.zero.label"), children: t("manual.7.zero.body") }),
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Line, { label: t("manual.7.sync.label"), children: t("manual.7.sync.body") })
		                  ] })
		                ]
		              }
		            )
		          ]
		        }
		      )
		    }
		  );
		}
		
		// src/client/scheme.ts
		function brightnessOf(cssColor) {
		  const match = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(cssColor);
		  if (match === null) return void 0;
		  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
		  if ([r, g, b].some((value) => Number.isNaN(value))) return void 0;
		  return 0.299 * r + 0.587 * g + 0.114 * b;
		}
		function schemeOfColor(cssColor) {
		  const brightness = brightnessOf(cssColor);
		  if (brightness === void 0) return "dark";
		  return brightness > 140 ? "dark" : "light";
		}
		function schemeFrom(declared, inheritedTextColor) {
		  const single = declared.trim().toLowerCase();
		  if (single === "light" || single === "dark") return single;
		  return schemeOfColor(inheritedTextColor);
		}
		function schemeOf(element) {
		  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return "dark";
		  const root = document.documentElement;
		  const declared = root === null ? "" : getComputedStyle(root).colorScheme;
		  const target = element ?? document.body;
		  if (target === null || target === void 0) return schemeFrom(declared, "");
		  return schemeFrom(declared, getComputedStyle(target).color);
		}
		
		// src/client/index.tsx
		var import_jsx_runtime4 = require("react/jsx-runtime");
		var name = "dsh-inbox-client";
		var inject = ["slots"];
		function apply(ctx) {
		  const slots = ctx.get("slots");
		  if (slots === void 0) return;
		  installLocale(ctx);
		  slots.inject(
		    "sidebar.panellist",
		    () => slots.register(
		      { name: "sidebar.panellist", id: PANEL_ID, order: 20, label: "Inbox" },
		      InboxPanelIcon
		    )
		  );
		  slots.inject("main", () => slots.register({ name: "main", key: PANEL_ID }, InboxPanel));
		  registerToolCards(slots);
		  registerInboxDock(ctx);
		}
		function InboxPanelIcon({ size, active }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		    "svg",
		    {
		      width: size,
		      height: size,
		      viewBox: "0 0 24 24",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: active ? 2 : 1.6,
		      strokeLinecap: "round",
		      strokeLinejoin: "round",
		      "aria-hidden": "true",
		      children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M3 12h5l2 3h4l2-3h5" }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5 5h14l2 7v7H3v-7z" })
		      ]
		    }
		  );
		}
		var panelStyle = {
		  padding: "16px 20px",
		  font: "14px/1.6 system-ui, sans-serif",
		  display: "flex",
		  flexDirection: "column",
		  gap: 12,
		  height: "100%",
		  minHeight: 0,
		  boxSizing: "border-box",
		  // No page scroll: the list is the only thing that scrolls, so it gets the
		  // whole screen minus the chrome above it and the pager can sit at its foot.
		  overflow: "hidden"
		};
		var RAIL_WIDTH = 176;
		var COLUMN_GAP = 14;
		var DETAIL_WIDTH = 380;
		var MIN_ITEM_WIDTH = 480;
		var SCROLLBAR = 10;
		var LIST_CHROME = 26 + SCROLLBAR;
		var LIST_GAP = 12;
		var RAIL_FOLD_WIDTH = MIN_ITEM_WIDTH * 2 + LIST_GAP + LIST_CHROME + RAIL_WIDTH + COLUMN_GAP;
		var DETAIL_FOLD_WIDTH = RAIL_FOLD_WIDTH + COLUMN_GAP + DETAIL_WIDTH;
		var actionStyle = {
		  display: "inline-flex",
		  alignItems: "center",
		  gap: 6,
		  padding: "6px 12px",
		  borderRadius: 8,
		  border: "1px solid color-mix(in srgb, currentColor 22%, transparent)",
		  background: "color-mix(in srgb, currentColor 9%, transparent)",
		  color: "inherit",
		  cursor: "pointer",
		  fontWeight: 500
		};
		var primaryStyle = {
		  ...actionStyle,
		  // Deliberately *not* an inverted fill. `background: currentColor; color:
		  // Canvas` looked right until it rendered white-on-white: `Canvas` is the
		  // canvas colour, which is white in a document that never declared a dark
		  // scheme. Text stays the inherited colour, on a fill strong enough to read as
		  // the primary action.
		  background: "color-mix(in srgb, currentColor 20%, transparent)",
		  borderColor: "color-mix(in srgb, currentColor 55%, transparent)",
		  fontWeight: 600
		};
		var dangerStyle = {
		  ...actionStyle,
		  borderColor: "color-mix(in srgb, salmon 60%, transparent)",
		  background: "color-mix(in srgb, salmon 18%, transparent)",
		  color: "salmon",
		  fontWeight: 600
		};
		var WATCH_COLOR = "#6e9ef7";
		var ACCENT_COLOR = "#6e9ef7";
		var MODEL_COLOR = "#a78bfa";
		var CONTROL_HEIGHT = "calc(1.6em + 12px)";
		var paneRowStyle = { flex: "none" };
		var selectStyle = {
		  ...actionStyle,
		  // Opaque on purpose: a translucent background is why the popup's options
		  // stayed white-on-white. `appearance: none` lets us draw the caret instead of
		  // letting the browser park it against the border.
		  appearance: "none",
		  paddingRight: 26,
		  background: "Canvas",
		  color: "CanvasText",
		  // Inherited from the panel root, which declares the app's own scheme.
		  colorScheme: "inherit"
		};
		function SelectBox({
		  value,
		  options,
		  disabled,
		  block,
		  label,
		  onChange
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		    "span",
		    {
		      style: {
		        position: "relative",
		        display: block === true ? "flex" : "inline-flex",
		        alignItems: "center",
		        // A control in a scrolling column keeps its own height (see
		        // `paneRowStyle`); without this the popup's box squeezes to nothing.
		        flex: "none",
		        ...block === true ? { width: "100%" } : {}
		      },
		      children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "select",
		          {
		            value,
		            disabled,
		            "aria-label": label,
		            onChange: (event) => onChange(event.target.value),
		            style: { ...selectStyle, ...block === true ? { flex: 1, minWidth: 0 } : {} },
		            children: options.map(([id, label2]) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: id, children: label2 }, id))
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          ChevronDown,
		          {
		            size: 13,
		            style: { position: "absolute", right: 9, pointerEvents: "none", opacity: 0.7 }
		          }
		        )
		      ]
		    }
		  );
		}
		var cardStyle = {
		  border: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
		  borderRadius: 10,
		  padding: 12
		};
		var buttonStyle = {
		  font: "inherit",
		  padding: "5px 12px",
		  borderRadius: 8,
		  border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
		  background: "transparent",
		  color: "inherit",
		  cursor: "pointer",
		  /*
		      A flex row rather than an inline box.
		  
		      Every one of these buttons is either a bare glyph or a glyph next to a word,
		      and an inline SVG lands on the text baseline: the icon reads as sitting low
		      in its own frame. It is the same defect the pager and the list-mode buttons
		      were fixed for one at a time (M7.12 / M7.13); the difference here is that it
		      is fixed once, for all of them.
		    */
		  display: "inline-flex",
		  alignItems: "center",
		  justifyContent: "center",
		  gap: 6
		};
		var pagerButtonStyle = {
		  ...buttonStyle,
		  whiteSpace: "nowrap"
		};
		var inputStyle = {
		  font: "inherit",
		  color: "inherit",
		  background: "transparent",
		  border: "1px solid color-mix(in srgb, currentColor 20%, transparent)",
		  borderRadius: 8,
		  padding: "5px 8px"
		};
		function InboxPanel() {
		  useLocaleRevision();
		  const [text, setText] = import_react8.default.useState("");
		  const [staged, setStaged] = import_react8.default.useState([]);
		  const [notice, setNotice] = import_react8.default.useState();
		  const [syncDetail, setSyncDetail] = import_react8.default.useState();
		  const [busy, setBusy] = import_react8.default.useState(false);
		  const [dragging, setDragging] = import_react8.default.useState(false);
		  const picker = import_react8.default.useRef(null);
		  const [scope, setScope] = import_react8.default.useState("live");
		  const [watchOnly, setWatchOnly] = import_react8.default.useState(false);
		  const [category, setCategory] = import_react8.default.useState();
		  const [tag, setTag] = import_react8.default.useState();
		  const [search, setSearch] = import_react8.default.useState("");
		  const [query, setQuery] = import_react8.default.useState("");
		  const [list, setList] = import_react8.default.useState();
		  const [selectedId, setSelectedId] = import_react8.default.useState();
		  const [detail, setDetail] = import_react8.default.useState();
		  const [settingsOpen, setSettingsOpen] = import_react8.default.useState(false);
		  const [manualOpen, setManualOpen] = import_react8.default.useState(false);
		  const [listMode, setListMode] = import_react8.default.useState("grid");
		  const [page, setPage] = import_react8.default.useState(0);
		  const [zoom, setZoom] = import_react8.default.useState();
		  const [panelWidth, setPanelWidth] = import_react8.default.useState(1400);
		  const [railOpen, setRailOpen] = import_react8.default.useState(false);
		  const panelRef = import_react8.default.useRef(null);
		  const [scheme, setScheme] = import_react8.default.useState(() => schemeOf(null));
		  import_react8.default.useEffect(() => {
		    const element = panelRef.current;
		    if (element === null || typeof ResizeObserver === "undefined") return;
		    const observer = new ResizeObserver((entries) => {
		      for (const entry of entries) setPanelWidth(entry.contentRect.width);
		    });
		    observer.observe(element);
		    return () => observer.disconnect();
		  }, []);
		  import_react8.default.useEffect(() => {
		    const read = () => setScheme(schemeOf(panelRef.current));
		    read();
		    if (typeof MutationObserver === "undefined") return;
		    const observer = new MutationObserver(read);
		    observer.observe(document.documentElement, { attributes: true });
		    if (document.body !== null) observer.observe(document.body, { attributes: true });
		    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : void 0;
		    media?.addEventListener("change", read);
		    return () => {
		      observer.disconnect();
		      media?.removeEventListener("change", read);
		    };
		  }, []);
		  const narrow = panelWidth < RAIL_FOLD_WIDTH;
		  const detailInline = panelWidth >= DETAIL_FOLD_WIDTH;
		  const hairline = "color-mix(in srgb, currentColor 12%, transparent)";
		  const call = import_react8.default.useCallback(
		    async (endpoint, payload) => {
		      try {
		        const response = await fetch(`${INBOX_API_PREFIX}/${endpoint}`, {
		          method: "POST",
		          headers: { "content-type": "application/json" },
		          body: JSON.stringify(payload)
		        });
		        const answer = await response.json();
		        if (!isRpcResult(answer)) {
		          return {
		            ok: false,
		            error: {
		              code: "inbox/malformed-answer",
		              message: t("notice.responseUnreadable", { status: response.status }),
		              details: {}
		            }
		          };
		        }
		        return answer;
		      } catch (error) {
		        return {
		          ok: false,
		          error: {
		            code: "inbox/transport",
		            message: error instanceof Error ? error.message : String(error),
		            details: {}
		          }
		        };
		      }
		    },
		    []
		  );
		  const refresh = import_react8.default.useCallback(
		    async (keepSelection = true) => {
		      const result = await call(INBOX_ENDPOINT_LIST, {
		        scope,
		        ...watchOnly ? { watchLater: true } : {},
		        ...category === void 0 ? {} : { categories: [category] },
		        ...tag === void 0 ? {} : { tags: [tag] },
		        ...query.trim().length === 0 ? {} : { text: query.trim() },
		        limit: PAGE_SIZE,
		        offset: page * PAGE_SIZE
		      });
		      if (!result.ok) {
		        setNotice(t("notice.listFailed", { reason: result.error.message }));
		        return;
		      }
		      const next = result.value;
		      if (!Array.isArray(next.entries)) {
		        setNotice(t("notice.listUnreadable"));
		        return;
		      }
		      setList(next);
		      if (!keepSelection || !next.entries.some((entry) => entry.id === selectedId)) {
		        setSelectedId(void 0);
		        setDetail(void 0);
		      }
		    },
		    [call, category, page, query, scope, selectedId, tag, watchOnly]
		  );
		  import_react8.default.useEffect(() => {
		    void refresh();
		  }, [refresh]);
		  import_react8.default.useEffect(() => {
		    refreshRef.current = refresh;
		  }, [refresh]);
		  import_react8.default.useEffect(() => {
		    setPage(0);
		  }, [scope, watchOnly, category, tag, query]);
		  import_react8.default.useEffect(() => {
		    const onKey = (event) => {
		      if (event.key !== "Escape") return;
		      setZoom(void 0);
		      setSettingsOpen(false);
		      setRailOpen(false);
		      if (!detailInline) {
		        setSelectedId(void 0);
		        setDetail(void 0);
		      }
		    };
		    window.addEventListener("keydown", onKey);
		    return () => window.removeEventListener("keydown", onKey);
		  }, [detailInline]);
		  import_react8.default.useEffect(() => {
		    if (notice === void 0 || notice.length === 0) return;
		    const timer = window.setTimeout(() => setNotice(void 0), 4e3);
		    return () => window.clearTimeout(timer);
		  }, [notice]);
		  const refreshRef = import_react8.default.useRef(async () => {
		  });
		  import_react8.default.useEffect(() => {
		    void (async () => {
		      const answer = await call(INBOX_ENDPOINT_UI, { action: "read" });
		      if (!answer.ok) return;
		      const prefs = answer.value;
		      if (UI_LIST_MODES.includes(prefs.listMode)) setListMode(prefs.listMode);
		    })();
		  }, [call]);
		  const chooseListMode = import_react8.default.useCallback(
		    (mode) => {
		      setListMode(mode);
		      void (async () => {
		        const answer = await call(INBOX_ENDPOINT_UI, {
		          action: "save",
		          listMode: mode
		        });
		        if (!answer.ok) setNotice(t("notice.listModeUnsaved", { reason: answer.error.message }));
		      })();
		    },
		    [call]
		  );
		  const refreshAll = import_react8.default.useCallback(async () => {
		    setBusy(true);
		    setNotice(t("notice.syncing"));
		    try {
		      const pushed = await call(INBOX_ENDPOINT_PUSH, {});
		      const pulled = await call(INBOX_ENDPOINT_PULL, {});
		      await refresh();
		      const pushFail = pushed.ok ? void 0 : t("notice.pushFailed", { reason: pushed.error.message });
		      const pullFail = pulled.ok ? void 0 : t("notice.pullFailed", { reason: pulled.error.message });
		      const pushCount = pushed.ok ? writtenBy(pushed.value) : 0;
		      const pullCount = pulled.ok ? arrivedFrom(pulled.value) : 0;
		      const warnings = pulled.ok ? syncWarnings(pulled.value) : "";
		      const idle = pushFail === void 0 && pullFail === void 0 && pushCount === 0 && pullCount === 0;
		      const short = idle ? t("sync.shortIdle") : [
		        pushFail ?? t("sync.shortPushed", { count: pushCount }),
		        pullFail ?? t("sync.shortPulled", { count: pullCount })
		      ].join(" \xB7 ");
		      setNotice(`${short}${warnings}`);
		      setSyncDetail(
		        [
		          pushed.ok ? describePush(pushed.value) : t("notice.pushFailed", { reason: pushed.error.message }),
		          pulled.ok ? describePull(pulled.value) : t("notice.pullFailed", { reason: pulled.error.message })
		        ].join(" \xB7 ")
		      );
		    } finally {
		      setBusy(false);
		    }
		  }, [call, refresh]);
		  const removeTagEverywhere = import_react8.default.useCallback(
		    async (name2, count) => {
		      if (!window.confirm(t("confirm.untag", { tag: name2, count })))
		        return;
		      setBusy(true);
		      try {
		        const result = await call(INBOX_ENDPOINT_TAGS, {
		          action: "remove",
		          tag: name2
		        });
		        if (!result.ok) {
		          setNotice(t("notice.tagRemoveFailed", { reason: result.error.message }));
		          return;
		        }
		        setTag(void 0);
		        await refresh(false);
		        setNotice(t("notice.tagRemoved", { tag: name2 }));
		      } finally {
		        setBusy(false);
		      }
		    },
		    [call, refresh]
		  );
		  import_react8.default.useEffect(() => {
		    const timer = window.setTimeout(() => setQuery(search), 250);
		    return () => window.clearTimeout(timer);
		  }, [search]);
		  const openDetail = import_react8.default.useCallback(
		    async (id) => {
		      setSelectedId(id);
		      const result = await call(INBOX_ENDPOINT_DETAIL, { id });
		      if (!result.ok) {
		        setNotice(t("notice.detailFailed", { reason: result.error.message }));
		        setDetail(void 0);
		        return;
		      }
		      setDetail(result.value.entry);
		    },
		    [call]
		  );
		  const mutate = import_react8.default.useCallback(
		    async (endpoint, payload, { dropSelection = false } = {}) => {
		      setBusy(true);
		      try {
		        const result = await call(endpoint, payload);
		        if (!result.ok) {
		          setNotice(`${result.error.message}`);
		          return false;
		        }
		        setNotice(void 0);
		        if (dropSelection) {
		          setSelectedId(void 0);
		          setDetail(void 0);
		        } else if (selectedId !== void 0 && !dropSelection) {
		          await openDetail(selectedId);
		        }
		        await refresh();
		        return true;
		      } finally {
		        setBusy(false);
		      }
		    },
		    [call, openDetail, refresh, selectedId]
		  );
		  const purge = import_react8.default.useCallback(async () => {
		    setBusy(true);
		    try {
		      const result = await call(INBOX_ENDPOINT_PURGE, {});
		      if (!result.ok) {
		        setNotice(t("notice.purgeFailed", { reason: result.error.message }));
		        return;
		      }
		      const value = result.value;
		      const remote = value.remoteSkipped === true ? t("notice.purgeNoRemote") : value.remoteRemoved === void 0 ? "" : t("notice.purgeRemote", { count: value.remoteRemoved });
		      setNotice(
		        t("notice.purgeDone", {
		          count: value.removed,
		          remote,
		          failure: value.reason === void 0 ? "" : t("notice.purgeFailedAtRemote", { reason: value.reason })
		        })
		      );
		      setSelectedId(void 0);
		      setDetail(void 0);
		      await refresh(false);
		    } finally {
		      setBusy(false);
		    }
		  }, [call, refresh]);
		  const stage = (files, extraText) => {
		    const next = [];
		    for (const file of Array.from(files)) {
		      const isImage = INBOX_IMAGE_TYPES.includes(file.type);
		      next.push({
		        id: `${file.name}:${file.size}:${file.lastModified}:${next.length}`,
		        name: file.name.length === 0 ? t("app.unnamedFile") : file.name,
		        slot: isImage ? "image" : "file",
		        bytes: file.size,
		        file,
		        ...isImage ? { previewUrl: URL.createObjectURL(file) } : {}
		      });
		    }
		    if (next.length > 0) setStaged((current) => [...current, ...next]);
		    if (extraText !== void 0 && extraText.length > 0) {
		      setText((current) => current.length === 0 ? extraText : `${current}
		${extraText}`);
		    }
		  };
		  const onPaste = (event) => {
		    const files = event.clipboardData.files;
		    if (files.length === 0) return;
		    event.preventDefault();
		    stage(files, event.clipboardData.getData("text/plain"));
		  };
		  const onDrop = (event) => {
		    event.preventDefault();
		    setDragging(false);
		    if (event.dataTransfer.files.length > 0) stage(event.dataTransfer.files);
		  };
		  const submit = async () => {
		    if (busy) return;
		    const trimmed = text.trim();
		    if (trimmed.length === 0 && staged.length === 0) {
		      setNotice(t("notice.captureEmpty"));
		      return;
		    }
		    setBusy(true);
		    setNotice(void 0);
		    try {
		      const images = [];
		      const files = [];
		      for (const entry of staged) {
		        const data = await toBase64(entry.file);
		        if (entry.slot === "image") {
		          images.push({ mediaType: entry.file.type, data, name: entry.name });
		        } else {
		          files.push({
		            data,
		            name: entry.name,
		            ...entry.file.type.length === 0 ? {} : { mediaType: entry.file.type }
		          });
		        }
		      }
		      const result = await call(INBOX_ENDPOINT_CAPTURE, { text: trimmed, images, files });
		      if (!result.ok) {
		        setNotice(t("notice.captureFailed", { reason: result.error.message }));
		        return;
		      }
		      setNotice(describe(result.value));
		      setText("");
		      for (const entry of staged) {
		        if (entry.previewUrl !== void 0) URL.revokeObjectURL(entry.previewUrl);
		      }
		      setStaged([]);
		      const wasInBin = scope === "bin";
		      if (wasInBin) {
		        setScope("live");
		        setWatchOnly(false);
		      } else {
		        await refresh(false);
		      }
		      window.setTimeout(() => void refreshRef.current(), 2500);
		    } finally {
		      setBusy(false);
		    }
		  };
		  const onKeyDown = (event) => {
		    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
		      event.preventDefault();
		      void submit();
		    }
		  };
		  const pageCount = Math.max(1, Math.ceil((list?.matched ?? 0) / PAGE_SIZE));
		  const listTitle = (() => {
		    const parts = [];
		    if (scope === "bin") parts.push(t("filter.bin"));
		    else {
		      if (category !== void 0) parts.push(categoryLabel(category));
		      if (watchOnly) parts.push(t("filter.watch"));
		    }
		    if (tag !== void 0) parts.push(`#${tag}`);
		    return parts.length === 0 ? t("filter.all") : parts.join(" \xB7 ");
		  })();
		  const zoomKind = zoom?.mime?.startsWith("video/") === true ? "video" : zoom?.mime?.startsWith("audio/") === true ? "audio" : "image";
		  const openEntryPreview = import_react8.default.useCallback((entry) => {
		    if (entry.previewId !== void 0) {
		      setZoom({
		        src: attachmentUrl(entry.previewId),
		        ...entry.previewMime === void 0 ? {} : { mime: entry.previewMime },
		        label: headingOf(entry)
		      });
		      return;
		    }
		    if (entry.url !== void 0) setZoom({ href: entry.url, label: headingOf(entry) });
		  }, []);
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { ref: panelRef, style: { ...panelStyle, colorScheme: scheme }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("style", { children: `
		        /*
		          Chromium ignores ::-webkit-scrollbar the moment the standard
		          scrollbar-width is set, so the two engines get the rule they can use:
		          engines that know ::-webkit-scrollbar get the 8px bar, and Firefox \u2014
		          which does not \u2014 falls back to its own thin one. Measured: with both
		          set, Chromium kept its 10px thin bar and the 8px rule did nothing.
		        */
		        @supports not selector(::-webkit-scrollbar) {
		          .dsh-inbox-scroll { scrollbar-width: thin; }
		        }
		        .dsh-inbox-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
		        .dsh-inbox-scroll::-webkit-scrollbar-track { background: transparent; }
		        .dsh-inbox-scroll::-webkit-scrollbar-thumb {
		          background: color-mix(in srgb, currentColor 22%, transparent);
		          border-radius: 8px;
		        }
		        .dsh-inbox-scroll::-webkit-scrollbar-thumb:hover {
		          background: color-mix(in srgb, currentColor 34%, transparent);
		        }
		        .dsh-inbox-scroll::-webkit-scrollbar-corner { background: transparent; }
		      ` }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("header", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "flex-start", gap: 10 }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { style: { margin: "0 0 4px" }, children: "dsh-inbox" }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { style: { margin: 0, opacity: 0.7 }, children: [
		          PACKAGE_NAME,
		          list === void 0 ? "" : t("app.counts", { total: list.total, watch: list.watchLater, deleted: list.deleted })
		        ] })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "button",
		        {
		          type: "button",
		          style: { ...buttonStyle, marginLeft: "auto" },
		          onClick: () => setManualOpen(true),
		          children: t("app.manual")
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		        "button",
		        {
		          type: "button",
		          style: buttonStyle,
		          "aria-expanded": settingsOpen,
		          onClick: () => setSettingsOpen((open) => !open),
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Settings2, { size: 14 }),
		            " ",
		            t("app.settings")
		          ]
		        }
		      )
		    ] }) }),
		    settingsOpen && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		      "div",
		      {
		        role: "dialog",
		        "aria-label": t("app.settings"),
		        style: {
		          position: "fixed",
		          inset: 0,
		          zIndex: 40,
		          background: "color-mix(in srgb, #000 55%, transparent)",
		          display: "flex",
		          alignItems: "flex-start",
		          justifyContent: "center",
		          padding: "6vh 16px",
		          overflow: "auto"
		        },
		        onClick: (event) => {
		          if (event.target === event.currentTarget) setSettingsOpen(false);
		        },
		        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { ...cardStyle, width: "min(560px, 100%)", background: "Canvas" }, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(EncryptionSettings, { call }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(WebdavSettings, { call, onClose: () => setSettingsOpen(false) })
		        ] })
		      }
		    ),
		    manualOpen && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ManualDialog, { onClose: () => setManualOpen(false) }),
		    zoom !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		      "div",
		      {
		        role: "dialog",
		        "aria-label": t("detail.zoom"),
		        style: {
		          position: "fixed",
		          inset: 0,
		          zIndex: 50,
		          background: "color-mix(in srgb, #000 78%, transparent)",
		          display: "flex",
		          flexDirection: "column",
		          alignItems: "center",
		          justifyContent: "center",
		          gap: 10,
		          padding: 20
		        },
		        onClick: () => setZoom(void 0),
		        children: [
		          zoom.src !== void 0 && zoomKind === "video" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "video",
		            {
		              src: zoom.src,
		              controls: true,
		              autoPlay: true,
		              playsInline: true,
		              onClick: (event) => event.stopPropagation(),
		              style: { maxWidth: "92vw", maxHeight: "80vh", borderRadius: 8, background: "#000" }
		            }
		          ),
		          zoom.src !== void 0 && zoomKind === "audio" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "audio",
		            {
		              src: zoom.src,
		              controls: true,
		              autoPlay: true,
		              onClick: (event) => event.stopPropagation(),
		              style: { width: "min(560px, 92vw)" }
		            }
		          ),
		          zoom.src !== void 0 && zoomKind === "image" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "img",
		            {
		              src: zoom.src,
		              alt: zoom.label,
		              style: { maxWidth: "92vw", maxHeight: "80vh", borderRadius: 8, background: "#000" }
		            }
		          ),
		          zoom.src === void 0 && /*
		            A video on someone else's site. Embedding their player would mean a
		            remote frame inside the panel and their own terms; handing the page
		            to the browser is the honest version, and it is also the big screen.
		          */
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		            "div",
		            {
		              onClick: (event) => event.stopPropagation(),
		              style: {
		                ...cardStyle,
		                maxWidth: "min(560px, 92vw)",
		                background: "Canvas",
		                color: "CanvasText",
		                display: "flex",
		                flexDirection: "column",
		                gap: 10,
		                alignItems: "flex-start"
		              },
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("detail.foreign") }),
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.75 }, children: t("detail.foreignBody") }),
		                zoom.href !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                  "a",
		                  {
		                    href: zoom.href,
		                    target: "_blank",
		                    rel: "noreferrer",
		                    style: { ...primaryStyle, textDecoration: "none" },
		                    children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ExternalLink, { size: 14 }),
		                      " ",
		                      t("detail.playInBrowser")
		                    ]
		                  }
		                )
		              ]
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 10, alignItems: "center", fontSize: 12, opacity: 0.85 }, children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { overflowWrap: "anywhere" }, children: zoom.label }),
		            zoom.src !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		              "a",
		              {
		                href: zoom.src,
		                target: "_blank",
		                rel: "noreferrer",
		                style: { color: "inherit", display: "inline-flex", alignItems: "center", gap: 4 },
		                children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ExternalLink, { size: 13 }),
		                  " ",
		                  t("detail.openInBrowser")
		                ]
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", style: buttonStyle, onClick: () => setZoom(void 0), children: [
		              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(X, { size: 13 }),
		              " ",
		              t("app.close")
		            ] })
		          ] })
		        ]
		      }
		    ),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		      "div",
		      {
		        style: {
		          ...cardStyle,
		          borderStyle: dragging ? "dashed" : "solid",
		          borderColor: dragging ? "currentColor" : cardStyle.borderColor
		        },
		        onDragOver: (event) => {
		          event.preventDefault();
		          setDragging(true);
		        },
		        onDragLeave: () => setDragging(false),
		        onDrop,
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "textarea",
		            {
		              value: text,
		              onChange: (event) => setText(event.target.value),
		              onPaste,
		              onKeyDown,
		              placeholder: t("capture.placeholder"),
		              rows: 3,
		              style: {
		                width: "100%",
		                boxSizing: "border-box",
		                resize: "vertical",
		                font: "inherit",
		                color: "inherit",
		                background: "transparent",
		                border: "none",
		                outline: "none"
		              }
		            }
		          ),
		          staged.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "ul",
		            {
		              style: {
		                listStyle: "none",
		                margin: "8px 0 0",
		                padding: 0,
		                display: "flex",
		                flexWrap: "wrap",
		                gap: 8
		              },
		              children: staged.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                "li",
		                {
		                  style: {
		                    display: "flex",
		                    alignItems: "center",
		                    gap: 6,
		                    padding: "4px 8px",
		                    borderRadius: 8,
		                    border: "1px solid color-mix(in srgb, currentColor 20%, transparent)"
		                  },
		                  children: [
		                    entry.previewUrl !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                      "img",
		                      {
		                        src: entry.previewUrl,
		                        alt: "",
		                        style: { width: 28, height: 28, objectFit: "cover", borderRadius: 4 }
		                      }
		                    ),
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { opacity: 0.85 }, children: [
		                      entry.slot === "image" ? "\u{1F5BC}" : "\u{1F4C4}",
		                      " ",
		                      entry.name,
		                      " \xB7 ",
		                      formatBytes(entry.bytes)
		                    ] }),
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                      "button",
		                      {
		                        type: "button",
		                        "aria-label": t("app.remove", { name: entry.name }),
		                        onClick: () => setStaged((current) => current.filter((item) => item.id !== entry.id)),
		                        style: { ...buttonStyle, padding: "0 6px", border: "none", opacity: 0.6 },
		                        children: "\xD7"
		                      }
		                    )
		                  ]
		                },
		                entry.id
		              ))
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 }, children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "input",
		              {
		                ref: picker,
		                type: "file",
		                multiple: true,
		                style: { display: "none" },
		                onChange: (event) => {
		                  if (event.target.files !== null) stage(event.target.files);
		                  event.target.value = "";
		                }
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		              "button",
		              {
		                type: "button",
		                style: buttonStyle,
		                disabled: busy,
		                onClick: () => picker.current?.click(),
		                children: [
		                  t("app.pickFile"),
		                  "\u2026"
		                ]
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", style: buttonStyle, disabled: busy, onClick: () => void submit(), children: busy ? t("app.saving") : t("app.store") })
		          ] })
		        ]
		      }
		    ),
		    notice !== void 0 && notice.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		      "div",
		      {
		        role: "status",
		        style: {
		          position: "fixed",
		          left: "50%",
		          top: "50%",
		          // Dead centre, not near the foot of the window: at `bottom: 28` the
		          // toast sat in the corner you are least likely to be looking at,
		          // and on a tall window it was a long way from the thing it was
		          // reporting on.
		          transform: "translate(-50%, -50%)",
		          zIndex: 60,
		          padding: "8px 14px",
		          borderRadius: 999,
		          border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
		          background: "Canvas",
		          color: "CanvasText",
		          boxShadow: "0 10px 30px #0006",
		          fontSize: 13,
		          maxWidth: "80vw",
		          // It reports; it does not invite a click. Centred over the list it
		          // would otherwise swallow the first click of whatever is under it.
		          pointerEvents: "none"
		        },
		        children: notice
		      }
		    ),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
		      narrow && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		        "button",
		        {
		          type: "button",
		          style: {
		            ...buttonStyle,
		            height: CONTROL_HEIGHT,
		            boxSizing: "border-box",
		            ...railOpen ? { borderColor: "currentColor" } : {}
		          },
		          "aria-expanded": railOpen,
		          onClick: () => setRailOpen((open) => !open),
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Layers, { size: 13 }),
		            " ",
		            t("app.filter")
		          ]
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "input",
		        {
		          value: search,
		          onChange: (event) => setSearch(event.target.value),
		          placeholder: t("search.placeholder"),
		          style: {
		            ...inputStyle,
		            flex: 1,
		            minWidth: 180,
		            // The same edge as the two buttons beside it: an input sized by its
		            // own line box happened to land within half a pixel, which is the
		            // kind of "almost" that still reads as crooked.
		            height: CONTROL_HEIGHT,
		            boxSizing: "border-box"
		          }
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "span",
		        {
		          role: "group",
		          "aria-label": t("modes.label"),
		          style: {
		            display: "inline-flex",
		            border: "1px solid color-mix(in srgb, currentColor 15%, transparent)",
		            borderRadius: 8,
		            overflow: "hidden",
		            height: CONTROL_HEIGHT,
		            boxSizing: "border-box"
		          },
		          children: LIST_MODES.map((mode) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "button",
		            {
		              type: "button",
		              title: t("modes.titleOf", { label: mode.label }),
		              "aria-pressed": listMode === mode.id,
		              onClick: () => chooseListMode(mode.id),
		              style: {
		                ...buttonStyle,
		                // The frame itself: no padding of its own (the group's height
		                // decides it), a fixed 38px width, and `height: 100%` of the
		                // group's inner box. With the glyph centred by `buttonStyle` the
		                // icon lands on the row's centre line — measured offset 0.
		                flex: "none",
		                width: 38,
		                height: "100%",
		                padding: 0,
		                boxSizing: "border-box",
		                border: "none",
		                borderRadius: 0,
		                opacity: listMode === mode.id ? 1 : 0.5
		              },
		              children: mode.icon
		            },
		            mode.id
		          ))
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		        "button",
		        {
		          type: "button",
		          title: syncDetail,
		          style: { ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: "border-box" },
		          disabled: busy,
		          onClick: () => void refreshAll(),
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RefreshCw, { size: 13 }),
		            " ",
		            busy ? t("app.refreshing") : t("app.refresh")
		          ]
		        }
		      )
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		      "div",
		      {
		        style: {
		          display: "grid",
		          /*
		            Anchors the folded rail's overlay (2026-10-02). When the panel is too
		            narrow for a rail column, the button in the toolbar opens the same
		            rail as a panel floating over the list's top-left corner — which is
		            where the button sits, one row above.
		          */
		          position: "relative",
		          // The list is the working surface; the detail is a reader pane beside
		          // it, so it gets a width rather than half the room. 320–380 rather
		          // than 250–300 because the detail's own action row ("保存描述与标签"
		          // next to "标为待看" next to "删除") is only one line at that width —
		          // and below 1180px it stops being a column at all (it becomes a dialog),
		          // which leaves the list the room instead.
		          gridTemplateColumns: narrow ? "minmax(0, 1fr)" : detailInline ? `${String(RAIL_WIDTH)}px minmax(0, 1fr) ${String(DETAIL_WIDTH)}px` : `${String(RAIL_WIDTH)}px minmax(0, 1fr)`,
		          /*
		                      One row, exactly as tall as the panel has room for.
		          
		                      Without this the row is content-sized and only *stretches* by the
		                      grid's default alignment, which left the rail and the list floating at
		                      their own heights with dead space under them (seen in the layout
		                      mirror, 2026-10-02). `minmax(0, 1fr)` states it instead: the row fills
		                      the panel, both cards are the same height, and the list scrolls inside
		                      its own card rather than growing the page.
		                    */
		          gridTemplateRows: "minmax(0, 1fr)",
		          gap: 14,
		          // Fill what the chrome above left, so the list can scroll inside it.
		          flex: 1,
		          minHeight: 0
		        },
		        children: [
		          (!narrow || railOpen) && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		            narrow && // Click anywhere else and the panel is gone — the same wash the
		            // settings sheet uses, one layer below the rail itself.
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "div",
		              {
		                role: "presentation",
		                onClick: () => setRailOpen(false),
		                style: { position: "fixed", inset: 0, zIndex: 38 }
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		              "nav",
		              {
		                "aria-label": t("app.filter"),
		                onClick: () => {
		                  if (narrow) setRailOpen(false);
		                },
		                style: narrow ? {
		                  /*
		                                      Folded: a panel over the list, not a third grid cell.
		                  
		                                      Rendered inside the grid but taken out of its flow, so it
		                                      cannot fight the list for a row (which is what made the button
		                                      look dead — asked 2026-10-02). Opaque on purpose: `Canvas` is
		                                      the host's own surface colour, so it reads as a sheet in both
		                                      themes.
		                                    */
		                  ...cardStyle,
		                  position: "absolute",
		                  top: 0,
		                  left: 0,
		                  zIndex: 39,
		                  display: "flex",
		                  flexDirection: "column",
		                  gap: 2,
		                  minWidth: 220,
		                  maxWidth: "min(320px, 90%)",
		                  maxHeight: "60vh",
		                  overflowY: "auto",
		                  background: "Canvas",
		                  boxShadow: "0 10px 30px #0006"
		                } : {
		                  ...cardStyle,
		                  display: "flex",
		                  flexDirection: "column",
		                  gap: 2,
		                  /*
		                                      As tall as the list beside it.
		                  
		                                      `alignSelf: 'start'` used to size this card to its own rows, so
		                                      a two-row rail floated next to a full-height list card with a
		                                      visible step at the bottom (asked 2026-10-02). Stretching is
		                                      the default for a grid item, so the fix is to stop opting out —
		                                      with `minHeight: 0` and a scroll so a rail with thirty
		                                      categories cannot push the page.
		                                    */
		                  minHeight: 0,
		                  overflowY: "auto"
		                },
		                children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                    RailRow,
		                    {
		                      active: scope === "live" && !watchOnly && category === void 0,
		                      icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Inbox, { size: 15 }),
		                      label: t("filter.all"),
		                      ...list === void 0 ? {} : { count: list.total },
		                      onClick: () => {
		                        setScope("live");
		                        setWatchOnly(false);
		                        setCategory(void 0);
		                      }
		                    }
		                  ),
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                    RailRow,
		                    {
		                      active: scope === "live" && watchOnly,
		                      icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Circle, { size: 15 }),
		                      label: t("filter.watch"),
		                      ...list === void 0 ? {} : { count: list.watchLater },
		                      onClick: () => {
		                        setScope("live");
		                        setWatchOnly(true);
		                        setCategory(void 0);
		                      }
		                    }
		                  ),
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                    RailRow,
		                    {
		                      active: scope === "bin",
		                      icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Trash, { size: 15 }),
		                      label: t("filter.bin"),
		                      ...list === void 0 ? {} : { count: list.deleted },
		                      onClick: () => {
		                        setScope("bin");
		                        setWatchOnly(false);
		                        setCategory(void 0);
		                      }
		                    }
		                  ),
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { margin: "8px 0 4px", padding: "0 9px", fontSize: 11, opacity: 0.6 }, children: t("app.category") }),
		                  CATEGORIES.map((value) => {
		                    const count = list?.categories.find((facet) => facet.value === value)?.count;
		                    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                      RailRow,
		                      {
		                        active: category === value,
		                        icon: categoryGlyph(value, 15),
		                        label: categoryLabel(value),
		                        ...list === void 0 ? {} : { count: count ?? 0 },
		                        onClick: () => {
		                          setCategory(category === value ? void 0 : value);
		                          setScope("live");
		                          setWatchOnly(false);
		                        }
		                      },
		                      value
		                    );
		                  }),
		                  list !== void 0 && list.tags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { margin: "8px 0 4px", padding: "0 9px", fontSize: 11, opacity: 0.6 }, children: t("app.tag") }),
		                    list.tags.map((facet) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 2 }, children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                        RailRow,
		                        {
		                          active: tag === facet.value,
		                          icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { size: 14 }),
		                          label: `#${facet.value}`,
		                          count: facet.count,
		                          onClick: () => setTag(tag === facet.value ? void 0 : facet.value)
		                        }
		                      ),
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                        "button",
		                        {
		                          type: "button",
		                          title: t("filter.untagAll", { tag: facet.value }),
		                          onClick: () => void removeTagEverywhere(facet.value, facet.count),
		                          style: { ...buttonStyle, border: "none", padding: "4px 5px", opacity: 0.6 },
		                          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(X, { size: 12 })
		                        }
		                      )
		                    ] }, facet.value))
		                  ] })
		                ]
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		            "section",
		            {
		              style: {
		                ...cardStyle,
		                minWidth: 0,
		                minHeight: 0,
		                display: "flex",
		                flexDirection: "column"
		              },
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                  "div",
		                  {
		                    style: {
		                      display: "flex",
		                      alignItems: "center",
		                      justifyContent: "space-between",
		                      gap: 8,
		                      marginBottom: 6
		                    },
		                    children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: listTitle }),
		                      scope === "bin" && (list?.deleted ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                        "button",
		                        {
		                          type: "button",
		                          style: buttonStyle,
		                          disabled: busy,
		                          onClick: () => {
		                            if (!window.confirm(
		                              t("confirm.purge")
		                            ))
		                              return;
		                            void purge();
		                          },
		                          children: [
		                            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Trash, { size: 13 }),
		                            " ",
		                            t("filter.clearBin")
		                          ]
		                        }
		                      )
		                    ]
		                  }
		                ),
		                (list === void 0 || list.matched > 0) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { textAlign: "right", fontSize: 12, opacity: 0.6, marginBottom: 6 }, children: list === void 0 ? t("app.loading") : t("app.matches", { count: list.matched }) }),
		                list?.entries.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: "8px 0 0", opacity: 0.7 }, children: scope === "bin" ? t("app.binEmpty") : t("app.noMatches") }),
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                  "div",
		                  {
		                    className: "dsh-inbox-scroll",
		                    style: listMode === "compact" ? {
		                      display: "flex",
		                      flexDirection: "column",
		                      gap: 0,
		                      flex: 1,
		                      minHeight: 0,
		                      overflowY: "auto"
		                    } : {
		                      display: "grid",
		                      /*
		                                            Always two columns, each with a 480px floor that yields only
		                                            to the panel itself.
		                      
		                                            `repeat(2, minmax(0, 1fr))` was the squeeze the user kept
		                                            seeing: no floor at all. `repeat(2, minmax(480px, 1fr))`
		                                            would be the opposite mistake — a 700px panel cannot hold
		                                            960px of cards, and the row would overflow sideways
		                                            (measured: a 439px panel). `min(480px, half a row)` is the
		                                            floor with the panel's own limit built in, so a row is
		                                            never wider than the room it has.
		                                          */
		                      gridTemplateColumns: `repeat(2, minmax(min(${String(MIN_ITEM_WIDTH)}px, calc((100% - ${String(LIST_GAP)}px) / 2)), 1fr))`,
		                      gap: LIST_GAP,
		                      alignContent: "start",
		                      flex: 1,
		                      minHeight: 0,
		                      overflowY: "auto"
		                    },
		                    children: list?.entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                      EntryCard,
		                      {
		                        entry,
		                        mode: listMode,
		                        selected: entry.id === selectedId,
		                        onOpen: () => void openDetail(entry.id),
		                        onPreview: () => openEntryPreview(entry)
		                      },
		                      entry.id
		                    ))
		                  }
		                ),
		                (list?.matched ?? 0) > 0 && pageCount > 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                  "div",
		                  {
		                    style: {
		                      display: "flex",
		                      alignItems: "center",
		                      gap: 8,
		                      marginTop: 10,
		                      opacity: 0.75,
		                      fontSize: 12
		                    },
		                    children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("pager.of", { page: page + 1, pages: pageCount }) }),
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { marginLeft: "auto" } }),
		                      page > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                        "button",
		                        {
		                          type: "button",
		                          style: pagerButtonStyle,
		                          onClick: () => setPage((current) => Math.max(0, current - 1)),
		                          children: [
		                            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChevronLeft, { size: 13 }),
		                            " ",
		                            t("app.prevPage")
		                          ]
		                        }
		                      ),
		                      page + 1 < pageCount && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                        "button",
		                        {
		                          type: "button",
		                          style: pagerButtonStyle,
		                          onClick: () => setPage((current) => current + 1),
		                          children: [
		                            t("app.nextPage"),
		                            " ",
		                            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChevronRight, { size: 13 })
		                          ]
		                        }
		                      )
		                    ]
		                  }
		                )
		              ]
		            }
		          ),
		          !detailInline ? detail !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "div",
		            {
		              role: "presentation",
		              style: {
		                position: "fixed",
		                inset: 0,
		                zIndex: 45,
		                background: "color-mix(in srgb, #000 45%, transparent)",
		                display: "flex",
		                alignItems: "center",
		                justifyContent: "center",
		                padding: 16
		              },
		              onClick: (event) => {
		                if (event.target !== event.currentTarget) return;
		                setSelectedId(void 0);
		                setDetail(void 0);
		              },
		              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                "div",
		                {
		                  role: "dialog",
		                  "aria-label": t("app.detail"),
		                  style: {
		                    width: "min(560px, 100%)",
		                    // The same shape as the wide column: a bounded box, a
		                    // scrolling content column inside it, and a pinned stamp — so
		                    // the dialog scrolls the record rather than the whole overlay.
		                    maxHeight: "88vh",
		                    display: "flex",
		                    flexDirection: "column",
		                    minHeight: 0,
		                    background: "Canvas",
		                    border: `1px solid ${hairline}`,
		                    borderRadius: 12,
		                    padding: 12,
		                    boxShadow: "0 18px 40px #0007"
		                  },
		                  children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                      "button",
		                      {
		                        type: "button",
		                        style: buttonStyle,
		                        onClick: () => {
		                          setSelectedId(void 0);
		                          setDetail(void 0);
		                        },
		                        children: [
		                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(X, { size: 13 }),
		                          " ",
		                          t("app.close")
		                        ]
		                      }
		                    ) }),
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                      EntryPane,
		                      {
		                        detail,
		                        busy,
		                        onUpdate: (patch) => mutate(INBOX_ENDPOINT_UPDATE, { id: detail.id, ...patch }),
		                        onDelete: () => mutate(INBOX_ENDPOINT_DELETE, { id: detail.id }, { dropSelection: true }),
		                        onRestore: () => mutate(INBOX_ENDPOINT_RESTORE, { id: detail.id }, { dropSelection: true }),
		                        onZoom: setZoom
		                      }
		                    )
		                  ]
		                }
		              )
		            }
		          ) : (
		            /*
		              Two things are load-bearing here. `position: relative` anchors the
		              pane's own timestamps, which are absolutely positioned against this
		              card so they stay inside the frame 16px above its bottom edge. The
		              flex column gives the pane a bounded height to scroll inside: a long
		              record (a 3k-character text, a stack of photos) used to grow the card
		              past the panel, taking the actions and the stamps out of reach.
		            */
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "section",
		              {
		                style: {
		                  ...cardStyle,
		                  minWidth: 0,
		                  position: "relative",
		                  display: "flex",
		                  flexDirection: "column",
		                  minHeight: 0
		                },
		                children: detail === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: 0, opacity: 0.7 }, children: t("app.pickOne") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                  EntryPane,
		                  {
		                    detail,
		                    busy,
		                    onUpdate: (patch) => mutate(INBOX_ENDPOINT_UPDATE, { id: detail.id, ...patch }),
		                    onDelete: () => mutate(INBOX_ENDPOINT_DELETE, { id: detail.id }, { dropSelection: true }),
		                    onRestore: () => mutate(INBOX_ENDPOINT_RESTORE, { id: detail.id }, { dropSelection: true }),
		                    onZoom: setZoom
		                  }
		                )
		              }
		            )
		          )
		        ]
		      }
		    )
		  ] });
		}
		function writtenBy(result) {
		  return result.status === "ok" || result.status === "partial" ? result.pushed : 0;
		}
		function arrivedFrom(result) {
		  return result.status === "ok" ? result.pulled + (result.merged ?? 0) : 0;
		}
		function syncWarnings(result) {
		  return warningsOf(result, false);
		}
		function warningsOf(result, verbose) {
		  const roots = result.foreignSyncRoots ?? [];
		  const foreign = roots.length === 0 ? "" : verbose ? t("sync.detailForeign", {
		    roots: roots.join("\u3001"),
		    ours: result.syncRoot ?? "",
		    records: result.foreignRecords ?? 0
		  }) : t("sync.pullForeignSync", { roots: roots.join("\u3001"), records: result.foreignRecords ?? 0 });
		  const failed = result.failed > 0 ? t("sync.pullFailures", { count: result.failed, reason: result.reason ?? "" }) : "";
		  const master = result.masterNote === void 0 ? "" : ` \xB7 ${result.masterNote}`;
		  return `${foreign}${failed}${master}`;
		}
		function describePush(result) {
		  if (result.status === "unconfigured") return t("sync.pushUnconfigured");
		  if (result.status === "failed") return t("sync.pushFailed", { reason: result.reason ?? t("sync.pushUnknown") });
		  const head = result.pushed === 0 && result.attachments === 0 ? t("sync.detailPushedIdle", { count: result.skipped }) : t("sync.detailPushed", { records: result.pushed, attachments: result.attachments });
		  return result.status === "partial" ? t("sync.pushPartial", { head, reason: result.reason ?? "" }) : head;
		}
		function describePull(result) {
		  if (result.status === "unconfigured") return result.reason ?? t("sync.pullNoAddress");
		  if (result.status === "failed") return t("sync.pullFailed", { reason: result.reason ?? t("sync.pushUnknown") });
		  const merged = result.merged ?? 0;
		  const head = t("sync.detailPulled", {
		    count: result.pulled + merged,
		    records: result.remoteRecords ?? 0,
		    files: result.remoteAttachments ?? 0
		  });
		  const gained = (result.added ?? 0) === 0 ? "" : t("sync.detailAdded", { count: result.added ?? 0 });
		  const deleted = (result.deletions ?? 0) === 0 ? "" : t("sync.detailDeleted", { count: result.deletions ?? 0 });
		  const purged = (result.purged ?? 0) === 0 ? "" : t("sync.detailPurged", { count: result.purged ?? 0 });
		  return `${head}${gained}${deleted}${purged}${warningsOf(result, true)}`;
		}
		function EncryptionSettings({ call }) {
		  const [status, setStatus] = import_react8.default.useState();
		  const [password, setPassword] = import_react8.default.useState("");
		  const [notice, setNotice] = import_react8.default.useState();
		  const [busy, setBusy] = import_react8.default.useState(false);
		  const stranded = status !== void 0 && !status.unlocked && !status.configured && status.sealedRecords > 0;
		  const waiting = status?.unreadable ?? 0;
		  const others = status?.otherMachines ?? 0;
		  const body = status === void 0 ? t("settings.secretsBody") : stranded ? t("settings.sealedNoParamsBody") : status.unlocked ? waiting > 0 ? others > 0 ? t("settings.otherPassword", { count: waiting }) : t("settings.otherPasswordNoParams", { count: waiting }) : t("settings.unlockedBody") : status.configured ? t("settings.lockedBody") : t("settings.secretsBody");
		  const send = import_react8.default.useCallback(
		    async (action) => {
		      setBusy(true);
		      try {
		        const result = await call(INBOX_ENDPOINT_SECRET, {
		          action,
		          ...password.length === 0 ? {} : { password }
		        });
		        if (!result.ok) {
		          setNotice(result.error.message);
		          return;
		        }
		        const next = result.value;
		        setStatus(next);
		        setPassword("");
		        setNotice(
		          action === "set" ? next.sealed === void 0 || next.sealed === 0 ? t("settings.passwordJustSet") : t("settings.passwordSealed", { count: next.sealed }) : action === "unlock" ? t("settings.unlocked") : action === "lock" ? t("settings.lockedNote") : void 0
		        );
		      } finally {
		        setBusy(false);
		      }
		    },
		    [call, password]
		  );
		  import_react8.default.useEffect(() => {
		    void send("status");
		  }, []);
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { style: { ...cardStyle, marginBottom: 12 }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("settings.secrets") }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, fontSize: 12 }, children: status === void 0 ? t("app.loading") : status.unlocked ? t("settings.unlocked") : status.configured ? t("settings.locked") : stranded ? t("settings.sealedNoParams", { count: status.sealedRecords }) : t("settings.noPassword") })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: "0 0 8px", opacity: 0.7, fontSize: 12 }, children: body }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "input",
		        {
		          type: "password",
		          value: password,
		          disabled: busy,
		          autoComplete: "new-password",
		          onChange: (event) => setPassword(event.target.value),
		          "aria-label": t("settings.masterPassword"),
		          placeholder: status?.configured === true || stranded ? t("settings.masterPasswordSet") : t("settings.masterPasswordNew"),
		          style: { ...inputStyle, flex: 1, minWidth: 160 }
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "button",
		        {
		          type: "button",
		          style: { ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: "border-box" },
		          disabled: busy || password.length === 0,
		          onClick: () => void send("set"),
		          children: t("settings.setOrChange")
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "button",
		        {
		          type: "button",
		          style: { ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: "border-box" },
		          disabled: busy || password.length === 0 || status?.configured !== true,
		          onClick: () => void send("unlock"),
		          children: t("settings.unlock")
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "button",
		        {
		          type: "button",
		          style: { ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: "border-box" },
		          disabled: busy || status?.unlocked !== true,
		          onClick: () => void send("lock"),
		          children: t("settings.lock")
		        }
		      )
		    ] }),
		    notice !== void 0 && notice.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: "6px 0 0", opacity: 0.8, fontSize: 12 }, children: notice })
		  ] });
		}
		function WebdavSettings({
		  call,
		  onClose
		}) {
		  const [status, setStatus] = import_react8.default.useState();
		  const [baseUrl, setBaseUrl] = import_react8.default.useState("");
		  const [directory, setDirectory] = import_react8.default.useState("/inbox");
		  const [adoptForeignRoots, setAdoptForeignRoots] = import_react8.default.useState(false);
		  const [username, setUsername] = import_react8.default.useState("");
		  const [password, setPassword] = import_react8.default.useState("");
		  const [protocol, setProtocol] = import_react8.default.useState("webdav");
		  const [endpoint, setEndpoint] = import_react8.default.useState("");
		  const [bucket, setBucket] = import_react8.default.useState("");
		  const [region, setRegion] = import_react8.default.useState("us-east-1");
		  const [signatureVersion, setSignatureVersion] = import_react8.default.useState("v4");
		  const [accessKeyId, setAccessKeyId] = import_react8.default.useState("");
		  const [s3UserAgent, setS3UserAgent] = import_react8.default.useState("");
		  const [webdavUserAgent, setWebdavUserAgent] = import_react8.default.useState("");
		  const [accessKeySecret, setAccessKeySecret] = import_react8.default.useState("");
		  const [probe, setProbe] = import_react8.default.useState();
		  const [notice, setNotice] = import_react8.default.useState();
		  const [busy, setBusy] = import_react8.default.useState(false);
		  const read = import_react8.default.useCallback(async () => {
		    const result = await call(INBOX_ENDPOINT_WEBDAV, { action: "read" });
		    if (!result.ok) {
		      setNotice(t("notice.settingsUnreadable", { reason: result.error.message }));
		      return;
		    }
		    const next = result.value;
		    setStatus(next);
		    setBaseUrl(next.settings.baseUrl);
		    setDirectory(next.settings.directory);
		    setAdoptForeignRoots(next.settings.adoptForeignRoots === true);
		    setUsername(next.settings.username);
		    setProtocol(next.settings.protocol);
		    setEndpoint(next.settings.endpoint);
		    setBucket(next.settings.bucket);
		    setRegion(next.settings.region);
		    setSignatureVersion(next.settings.signatureVersion);
		    setAccessKeyId(next.settings.accessKeyId);
		    setS3UserAgent(next.settings.userAgent);
		    setWebdavUserAgent(next.settings.webdavUserAgent);
		    setPassword("");
		    setAccessKeySecret("");
		  }, [call]);
		  import_react8.default.useEffect(() => {
		    void read();
		  }, [read]);
		  const userAgent = protocol === "s3" ? s3UserAgent : webdavUserAgent;
		  const verdict = probeVerdict(probe ?? []);
		  const setUserAgent = (value) => {
		    if (protocol === "s3") setS3UserAgent(value);
		    else setWebdavUserAgent(value);
		  };
		  const save = async () => {
		    setBusy(true);
		    try {
		      const request = {
		        action: "save",
		        protocol,
		        baseUrl,
		        directory,
		        adoptForeignRoots,
		        username,
		        // Sending nothing leaves the stored password alone; sending "" clears it.
		        ...password.length === 0 ? {} : { password },
		        endpoint,
		        bucket,
		        region,
		        signatureVersion,
		        accessKeyId,
		        userAgent,
		        ...accessKeySecret.length === 0 ? {} : { accessKeySecret }
		      };
		      const result = await call(INBOX_ENDPOINT_WEBDAV, request);
		      if (!result.ok) {
		        setNotice(t("notice.settingsFailed", { reason: result.error.message }));
		        return;
		      }
		      setStatus(result.value);
		      setPassword("");
		      setAccessKeySecret("");
		      setNotice(t("notice.settingsSaved"));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const selfTest = async () => {
		    setBusy(true);
		    setProbe(void 0);
		    try {
		      const result = await call(INBOX_ENDPOINT_PROBE, {});
		      if (!result.ok) {
		        setNotice(t("notice.probeFailed", { reason: result.error.message }));
		        return;
		      }
		      setProbe(result.value);
		      setNotice(t("notice.probeDone"));
		    } finally {
		      setBusy(false);
		    }
		  };
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { style: { ...cardStyle, display: "flex", flexDirection: "column", gap: 8 }, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 10 }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("settings.ingest") }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.65 }, children: status === void 0 ? t("app.loading") : t("settings.status", {
		        settings: status.settingsAvailable ? t("settings.statusOn") : t("settings.statusOff"),
		        webdav: status.passwordSet ? t("settings.statusWebdavSet") : t("settings.statusWebdavUnset"),
		        s3: status.secretSet ? t("settings.statusS3Set") : t("settings.statusS3Unset")
		      }) }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", style: { ...buttonStyle, marginLeft: "auto" }, onClick: onClose, children: t("app.close") })
		    ] }),
		    status !== void 0 && !status.settingsAvailable && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: 0, opacity: 0.75 }, children: t("settings.noServiceBody") }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.protocol") }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        SelectBox,
		        {
		          value: protocol,
		          options: [
		            ["webdav", "WebDAV"],
		            ["s3", "S3"]
		          ],
		          disabled: busy,
		          onChange: (next) => setProtocol(next === "s3" ? "s3" : "webdav")
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.6 }, children: t("settings.protocolHint") })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.clientId") }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "input",
		        {
		          value: userAgent,
		          disabled: busy,
		          onChange: (event) => setUserAgent(event.target.value),
		          placeholder: protocol === "s3" ? t("settings.clientIdS3") : t("settings.clientIdWebdav"),
		          style: { ...inputStyle, flex: 1 }
		        }
		      )
		    ] }),
		    protocol === "webdav" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.bucketAddress") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: baseUrl,
		            disabled: busy,
		            onChange: (event) => setBaseUrl(event.target.value),
		            placeholder: "https://data.cstcloud.cn/dav",
		            style: { ...inputStyle, flex: 1 }
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.bucketDir") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: directory,
		            disabled: busy,
		            onChange: (event) => setDirectory(event.target.value),
		            placeholder: t("settings.directoryPlaceholder"),
		            style: { ...inputStyle, flex: 1 }
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { opacity: 0.6 }, children: [
		          t("settings.bucketHint"),
		          " \xB7 ",
		          t("settings.syncRootNow", { root: syncRootFor(directory) })
		        ] })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.username") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: username,
		            disabled: busy,
		            onChange: (event) => setUsername(event.target.value),
		            style: { ...inputStyle, flex: 1 }
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.password") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            type: "password",
		            value: password,
		            disabled: busy || status?.credentialsAvailable === false,
		            onChange: (event) => setPassword(event.target.value),
		            placeholder: status?.passwordSet === true ? t("settings.passwordStored") : t("settings.passwordStore"),
		            style: { ...inputStyle, flex: 1 }
		          }
		        )
		      ] })
		    ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.endpoint") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: endpoint,
		            disabled: busy,
		            onChange: (event) => setEndpoint(event.target.value),
		            placeholder: t("settings.endpointPlaceholder"),
		            style: { ...inputStyle, flex: 1 }
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: "Bucket" }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: bucket,
		            disabled: busy,
		            onChange: (event) => setBucket(event.target.value),
		            style: { ...inputStyle, flex: 1 }
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.signature") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          SelectBox,
		          {
		            value: signatureVersion,
		            options: [
		              ["v4", "v4"],
		              ["v2", t("settings.signatureV2")]
		            ],
		            disabled: busy,
		            onChange: setSignatureVersion
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 40 }, children: t("settings.region") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: region,
		            disabled: busy,
		            onChange: (event) => setRegion(event.target.value),
		            placeholder: "us-east-1",
		            style: { ...inputStyle, width: 140 }
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: "AccessKey ID" }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: accessKeyId,
		            disabled: busy,
		            onChange: (event) => setAccessKeyId(event.target.value),
		            style: { ...inputStyle, flex: 1 }
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: "Secret" }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            type: "password",
		            value: accessKeySecret,
		            disabled: busy || status?.credentialsAvailable === false,
		            onChange: (event) => setAccessKeySecret(event.target.value),
		            placeholder: status?.secretSet === true ? t("settings.passwordStored") : t("settings.passwordStore"),
		            style: { ...inputStyle, flex: 1 }
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7, minWidth: 64 }, children: t("settings.bucketDir") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            value: directory,
		            disabled: busy,
		            onChange: (event) => setDirectory(event.target.value),
		            placeholder: t("settings.directoryPlaceholder"),
		            style: { ...inputStyle, flex: 1 }
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { opacity: 0.6 }, children: [
		          t("settings.bucketHint"),
		          " \xB7 ",
		          t("settings.syncRootNow", { root: syncRootFor(directory) })
		        ] })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center", flex: "1 0 100%" }, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "input",
		          {
		            type: "checkbox",
		            checked: adoptForeignRoots,
		            disabled: busy,
		            onChange: (event) => setAdoptForeignRoots(event.target.checked)
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("settings.adoptForeign") }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.6 }, children: t("settings.adoptForeignHint") })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", style: buttonStyle, disabled: busy, onClick: () => void save(), children: t("settings.save") }),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", style: buttonStyle, disabled: busy, onClick: () => void selfTest(), children: t("settings.probe") }),
		      detailNotice(notice)
		    ] }),
		    probe !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { margin: 0, display: "flex", flexDirection: "column", gap: 6 }, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		        "p",
		        {
		          style: {
		            margin: 0,
		            color: verdict.ok ? "inherit" : "salmon",
		            fontWeight: 600
		          },
		          children: [
		            verdict.ok ? "\u2705 " : "\u274C ",
		            verdict.title
		          ]
		        }
		      ),
		      verdict.hint !== void 0 && verdict.hint.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: 0, opacity: 0.7 }, children: verdict.hint }),
		      probe.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("details", { children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("summary", { style: { cursor: "pointer", opacity: 0.7, fontSize: 12 }, children: t("settings.details", { count: probe.length }) }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		          "pre",
		          {
		            style: {
		              ...inputStyle,
		              margin: "6px 0 0",
		              maxHeight: 220,
		              overflow: "auto",
		              whiteSpace: "pre-wrap",
		              fontSize: 12
		            },
		            children: probe.map(
		              (row) => `${row.status === 0 ? "ERR" : String(row.status)}  ${row.label}
		     ${row.url}
		     ${row.detail}`
		            ).join("\n")
		          }
		        )
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: 0, opacity: 0.6 }, children: t("settings.ingestOnly") })
		  ] });
		}
		function detailNotice(notice) {
		  return notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.8 }, children: notice });
		}
		var LIST_MODES = [
		  { id: "grid", label: t("modes.grid"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LayoutGrid, { size: 14 }) },
		  { id: "compact", label: t("modes.compact"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Layers, { size: 14 }) }
		];
		function categoryGlyph(category, size) {
		  switch (category) {
		    case "idea":
		      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Lightbulb, { size });
		    case "article":
		      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FileText, { size });
		    case "media":
		      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Film, { size });
		    case "image":
		      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Image, { size });
		    case "document":
		      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IdCard, { size });
		    case "secret":
		      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(KeyRound, { size });
		    case "other":
		      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Layers, { size });
		  }
		}
		function tileBackground(entry) {
		  if (entry.kind === "image") {
		    return "repeating-linear-gradient(135deg, color-mix(in srgb, currentColor 14%, transparent) 0 10px, color-mix(in srgb, currentColor 7%, transparent) 10px 20px)";
		  }
		  if (entry.platform === "bilibili" || entry.platform === "xiaoyuzhou") {
		    return "linear-gradient(135deg, color-mix(in srgb, currentColor 16%, transparent), color-mix(in srgb, currentColor 6%, transparent))";
		  }
		  return "color-mix(in srgb, currentColor 8%, transparent)";
		}
		function SourceBadge({ source }) {
		  const tint = source === "user" ? WATCH_COLOR : source === "model" ? MODEL_COLOR : void 0;
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		    "span",
		    {
		      title: sourceHint(source),
		      style: {
		        flex: "none",
		        display: "inline-flex",
		        alignItems: "center",
		        padding: "1px 8px",
		        borderRadius: 999,
		        fontSize: 11,
		        fontWeight: 600,
		        whiteSpace: "nowrap",
		        ...tint === void 0 ? {
		          // The rule is the default, and the default is not news: it stays
		          // grey so the two that mean "somebody made a judgement" stand out.
		          background: "color-mix(in srgb, currentColor 8%, transparent)",
		          border: "1px solid color-mix(in srgb, currentColor 20%, transparent)",
		          color: "inherit",
		          opacity: 0.7
		        } : {
		          background: `color-mix(in srgb, ${tint} 18%, transparent)`,
		          border: `1px solid color-mix(in srgb, ${tint} 55%, transparent)`,
		          color: tint
		        }
		      },
		      children: sourceLabel(source)
		    }
		  );
		}
		function RailRow({
		  active,
		  icon,
		  label,
		  count,
		  onClick
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		    "button",
		    {
		      type: "button",
		      "aria-pressed": active,
		      onClick,
		      style: {
		        display: "flex",
		        alignItems: "center",
		        gap: 8,
		        width: "100%",
		        textAlign: "left",
		        font: "inherit",
		        color: "inherit",
		        background: active ? "color-mix(in srgb, currentColor 12%, transparent)" : "transparent",
		        border: "none",
		        borderRadius: 8,
		        padding: "6px 9px",
		        cursor: "pointer",
		        opacity: active ? 1 : 0.72
		      },
		      children: [
		        icon,
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { flex: 1, minWidth: 0, overflowWrap: "anywhere" }, children: label }),
		        count === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.6, fontSize: 12 }, children: count })
		      ]
		    }
		  );
		}
		function EntryCard({
		  entry,
		  mode,
		  selected,
		  onOpen,
		  onPreview
		}) {
		  const secret = isSecret(entry);
		  const headingText = headingOf(entry);
		  const headingTitle = headingTooltipOf(entry);
		  const compact = mode === "compact";
		  const hairline = "color-mix(in srgb, currentColor 10%, transparent)";
		  const accent = `color-mix(in srgb, ${ACCENT_COLOR} 55%, transparent)`;
		  const glyph = /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		    "span",
		    {
		      "aria-hidden": true,
		      style: {
		        flex: "none",
		        display: "grid",
		        placeItems: "center",
		        background: tileBackground(entry),
		        width: 38,
		        height: 38,
		        borderRadius: 8,
		        border: `1px solid ${hairline}`
		      },
		      children: categoryGlyph(entry.category, 22)
		    }
		  );
		  const previewMime = entry.previewMime ?? "";
		  const previewKind = previewMime.startsWith("video/") ? "video" : previewMime.startsWith("audio/") ? "audio" : previewMime.startsWith("image/") ? "image" : void 0;
		  const mediaLink = entry.kind === "link" && (entry.platform === "bilibili" || entry.platform === "xiaoyuzhou");
		  const preview = compact || previewKind === void 0 && !mediaLink ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		    "button",
		    {
		      type: "button",
		      title: previewKind === void 0 ? t("detail.playInBrowser") : t("detail.zoomInPanel"),
		      onClick: (event) => {
		        event.stopPropagation();
		        onPreview();
		      },
		      style: {
		        flex: "none",
		        width: 64,
		        height: 64,
		        padding: 0,
		        display: "grid",
		        placeItems: "center",
		        overflow: "hidden",
		        background: tileBackground(entry),
		        border: `1px solid ${hairline}`,
		        borderRadius: 8,
		        color: "inherit",
		        cursor: previewKind === void 0 ? "pointer" : "zoom-in"
		      },
		      children: previewKind === "image" && entry.previewId !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		        "img",
		        {
		          src: attachmentUrl(entry.previewId),
		          alt: "",
		          loading: "lazy",
		          style: {
		            width: "100%",
		            height: "100%",
		            objectFit: "cover",
		            objectPosition: "center",
		            display: "block"
		          }
		        }
		      ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Play, { size: 26 })
		    }
		  );
		  return (
		    /*
		      A div carrying a button's semantics rather than a `<button>`: the preview
		      slot is a real button of its own, and interactive content may not nest.
		     */
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		      "div",
		      {
		        role: "button",
		        tabIndex: 0,
		        "aria-pressed": selected,
		        onClick: onOpen,
		        onKeyDown: (event) => {
		          if (event.key !== "Enter" && event.key !== " ") return;
		          event.preventDefault();
		          onOpen();
		        },
		        style: {
		          position: "relative",
		          display: "flex",
		          alignItems: "center",
		          gap: compact ? 8 : 10,
		          width: "100%",
		          // A div is content-box by default, a `<button>` was not.
		          boxSizing: "border-box",
		          // One height for every card in the grid, whether or not it has a preview
		          // line to fill: the tallest natural card is the one with a picture
		          // (three text lines beside a 64px thumbnail), while a record whose
		          // heading doubles as its preview only fills two. 94 is what that tallest
		          // card measures with the panel's own font — the panel sets 14px/1.6
		          // system-ui rather than inheriting dsh's, so the number does not move.
		          ...compact ? {} : { minHeight: 94 },
		          textAlign: "left",
		          font: "inherit",
		          color: "inherit",
		          background: selected ? `color-mix(in srgb, ${ACCENT_COLOR} 16%, transparent)` : compact ? "transparent" : "color-mix(in srgb, currentColor 4%, transparent)",
		          ...compact ? { border: "none", borderBottom: `1px solid ${hairline}`, borderRadius: 0 } : {
		            border: `1px solid ${selected ? accent : hairline}`,
		            borderRadius: 10
		          },
		          padding: compact ? "5px 10px" : "9px 10px",
		          cursor: "pointer",
		          opacity: 1
		        },
		        children: [
		          glyph,
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		            "span",
		            {
		              style: {
		                minWidth: 0,
		                flex: 1,
		                display: "flex",
		                // Grid stacks title / preview / metadata; compact puts the title and
		                // the right-hand category-and-date on one line, all centred on the
		                // same axis as the glyph.
		                flexDirection: compact ? "row" : "column",
		                alignItems: compact ? "center" : "stretch",
		                gap: compact ? 8 : 3
		              },
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                  "span",
		                  {
		                    style: {
		                      display: "flex",
		                      alignItems: "center",
		                      gap: 6,
		                      minWidth: 0,
		                      ...compact ? { flex: 1 } : {}
		                    },
		                    children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                        "span",
		                        {
		                          title: headingTitle,
		                          style: {
		                            display: "block",
		                            minWidth: 0,
		                            // Width has a ceiling and a tail: no heading may stretch the card
		                            // or push the metadata around, it ellipsises instead.
		                            maxWidth: "100%",
		                            overflow: "hidden",
		                            textOverflow: "ellipsis",
		                            whiteSpace: "nowrap"
		                          },
		                          children: headingText
		                        }
		                      ),
		                      entry.watchLater && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                        "span",
		                        {
		                          style: {
		                            flex: "none",
		                            display: "inline-flex",
		                            alignItems: "center",
		                            gap: 3,
		                            padding: "0 7px",
		                            borderRadius: 999,
		                            fontSize: 11,
		                            fontWeight: 600,
		                            background: `color-mix(in srgb, ${WATCH_COLOR} 20%, transparent)`,
		                            border: `1px solid color-mix(in srgb, ${WATCH_COLOR} 55%, transparent)`,
		                            color: WATCH_COLOR
		                          },
		                          children: [
		                            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Bookmark, { size: 11 }),
		                            " ",
		                            t("filter.watch")
		                          ]
		                        }
		                      )
		                    ]
		                  }
		                ),
		                !compact && !secret && entry.preview !== void 0 && entry.preview !== headingText && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                  "span",
		                  {
		                    title: entry.preview,
		                    style: {
		                      display: "block",
		                      minWidth: 0,
		                      opacity: 0.65,
		                      overflow: "hidden",
		                      textOverflow: "ellipsis",
		                      whiteSpace: "nowrap"
		                    },
		                    children: entry.preview.slice(0, 90)
		                  }
		                ),
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                  "span",
		                  {
		                    style: {
		                      display: "flex",
		                      gap: 6,
		                      alignItems: "center",
		                      minWidth: 0,
		                      overflow: "hidden",
		                      whiteSpace: "nowrap",
		                      ...compact ? {} : { marginTop: 4 },
		                      fontSize: 12,
		                      opacity: 0.6
		                    },
		                    children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: categoryLabel(entry.category) }),
		                      entry.platform !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
		                        "\xB7 ",
		                        entry.platform
		                      ] }),
		                      entry.attachmentCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
		                        "\xB7 ",
		                        entry.attachmentCount,
		                        " ",
		                        t("app.tag")
		                      ] }),
		                      entry.deletedAt !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { color: "salmon" }, children: [
		                        "\xB7 ",
		                        t("filter.bin")
		                      ] }),
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { flex: "none" }, children: [
		                        "\xB7 ",
		                        new Date(entry.createdAt).toLocaleDateString()
		                      ] }),
		                      entry.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }, children: [
		                        "#",
		                        tag
		                      ] }, tag))
		                    ]
		                  }
		                )
		              ]
		            }
		          ),
		          preview
		        ]
		      }
		    )
		  );
		}
		function EntryPane({
		  detail,
		  busy,
		  onUpdate,
		  onDelete,
		  onRestore,
		  onZoom
		}) {
		  const [note, setNote] = import_react8.default.useState(detail.note ?? "");
		  const [title, setTitle] = import_react8.default.useState(detail.title ?? "");
		  const [tags, setTags] = import_react8.default.useState(detail.tags.join(", "));
		  import_react8.default.useEffect(() => {
		    setNote(detail.note ?? "");
		    setTitle(detail.title ?? "");
		    setTags(detail.tags.join(", "));
		  }, [detail]);
		  const inBin = detail.deletedAt !== void 0;
		  return (
		    /*
		      Two siblings rather than one column: the content scrolls inside the card
		      (a long text, a stack of photos, and the form all have to stay reachable),
		      while the timestamps hang off the *frame* — absolutely positioned against
		      the card, 16px above its bottom edge, where neither the content's length
		      nor its scrolling can move them. The content's `paddingBottom` keeps the
		      last control clear of the band they occupy.
		    */
		    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		        "div",
		        {
		          className: "dsh-inbox-scroll",
		          style: {
		            flex: 1,
		            minHeight: 0,
		            overflowY: "auto",
		            // The band the stamps sit in is reserved structurally rather than as
		            // padding: a scroll container's padding-bottom is *inside* the scroll
		            // area, so the last control would still slide under the stamps while
		            // scrolling. A margin takes the room out of the scrollport instead.
		            marginBottom: 40,
		            // Reserve the scrollbar's lane whether or not this record needs one,
		            // so the controls do not change width as you click from record to
		            // record (354px wide when they fit, 339px once a scrollbar appears).
		            scrollbarGutter: "stable",
		            display: "flex",
		            flexDirection: "column",
		            gap: 10
		          },
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		              "div",
		              {
		                style: {
		                  ...paneRowStyle,
		                  display: "flex",
		                  gap: 8,
		                  // Centre, not baseline: the source is a pill now, and a pill aligned
		                  // on the text baseline hangs off the bottom of the line.
		                  alignItems: "center",
		                  flexWrap: "wrap"
		                },
		                children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: kindLabel(detail.kind) }),
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.6 }, children: categoryLabel(detail.category) }),
		                  detail.categorySource !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SourceBadge, { source: detail.categorySource }),
		                  detail.platform !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.6 }, children: detail.platform })
		                ]
		              }
		            ),
		            detail.url !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "a",
		              {
		                href: detail.url,
		                target: "_blank",
		                rel: "noreferrer",
		                style: { ...paneRowStyle, overflowWrap: "anywhere" },
		                children: detail.url
		              }
		            ),
		            detail.text !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "pre",
		              {
		                style: {
		                  ...paneRowStyle,
		                  ...cardStyle,
		                  margin: 0,
		                  whiteSpace: "pre-wrap",
		                  overflowWrap: "anywhere",
		                  font: "13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
		                  maxHeight: 260,
		                  overflow: "auto"
		                },
		                children: detail.text
		              }
		            ),
		            detail.text === void 0 && detail.category === "secret" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { ...paneRowStyle, margin: 0, opacity: 0.75 }, children: t("detail.sealedNote") }),
		            detail.attachments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "div",
		              {
		                style: {
		                  ...paneRowStyle,
		                  display: "flex",
		                  gap: 10,
		                  flexWrap: "wrap",
		                  justifyContent: "center"
		                },
		                children: detail.attachments.map((attachment) => {
		                  const src = attachmentUrl(attachment.id);
		                  const caption = attachmentCaption(attachment);
		                  const playable = attachment.mime.startsWith("video/") || attachment.mime.startsWith("audio/");
		                  if (!attachment.image && !playable) {
		                    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                      "figure",
		                      {
		                        style: { ...cardStyle, margin: 0, padding: 8, textAlign: "center" },
		                        children: [
		                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { opacity: 0.7 }, children: "\u{1F4C4}" }),
		                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("figcaption", { style: { opacity: 0.7, marginTop: 4, fontSize: 12 }, children: caption })
		                        ]
		                      },
		                      attachment.id
		                    );
		                  }
		                  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                    "figure",
		                    {
		                      style: {
		                        margin: 0,
		                        maxWidth: "100%",
		                        display: "flex",
		                        flexDirection: "column",
		                        alignItems: "center",
		                        gap: 4
		                      },
		                      children: [
		                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                          "button",
		                          {
		                            type: "button",
		                            title: playable ? t("detail.play") : t("detail.zoom"),
		                            onClick: () => onZoom({ src, mime: attachment.mime, label: caption }),
		                            style: {
		                              padding: 0,
		                              border: "none",
		                              background: "none",
		                              cursor: playable ? "pointer" : "zoom-in"
		                            },
		                            children: playable ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                              "span",
		                              {
		                                style: {
		                                  display: "grid",
		                                  placeItems: "center",
		                                  width: 160,
		                                  height: 90,
		                                  borderRadius: 6,
		                                  border: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
		                                  background: tileBackground(detail),
		                                  color: "inherit"
		                                },
		                                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Play, { size: 28 })
		                              }
		                            ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                              "img",
		                              {
		                                src,
		                                alt: attachment.filename ?? "",
		                                style: { maxWidth: 220, maxHeight: 220, borderRadius: 6, display: "block" }
		                              }
		                            )
		                          }
		                        ),
		                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                          "figcaption",
		                          {
		                            style: {
		                              opacity: 0.7,
		                              fontSize: 12,
		                              textAlign: "center",
		                              overflowWrap: "anywhere"
		                            },
		                            children: caption
		                          }
		                        )
		                      ]
		                    },
		                    attachment.id
		                  );
		                })
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "input",
		              {
		                value: title,
		                disabled: busy,
		                maxLength: MAX_TITLE_CHARS,
		                onChange: (event) => setTitle(event.target.value),
		                "aria-label": t("detail.name"),
		                title: t("detail.nameTitle"),
		                placeholder: t("detail.namePlaceholder"),
		                style: { ...paneRowStyle, ...inputStyle, width: "100%", boxSizing: "border-box" }
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              SelectBox,
		              {
		                block: true,
		                label: t("app.category"),
		                value: detail.category,
		                options: CATEGORIES.map((value) => [value, categoryLabel(value)]),
		                disabled: busy,
		                onChange: (next) => void onUpdate({ category: next })
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "textarea",
		              {
		                value: note,
		                disabled: busy,
		                onChange: (event) => setNote(event.target.value),
		                rows: 2,
		                "aria-label": t("detail.note"),
		                title: t("detail.noteTitle"),
		                placeholder: t("detail.notePlaceholder"),
		                style: {
		                  ...paneRowStyle,
		                  ...inputStyle,
		                  resize: "vertical",
		                  width: "100%",
		                  boxSizing: "border-box"
		                }
		              }
		            ),
		            detail.tags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "div",
		              {
		                style: {
		                  ...paneRowStyle,
		                  display: "flex",
		                  gap: 6,
		                  alignItems: "center",
		                  flexWrap: "wrap"
		                },
		                children: detail.tags.map((value) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                  "span",
		                  {
		                    style: {
		                      display: "inline-flex",
		                      alignItems: "center",
		                      gap: 4,
		                      // Never let a flex row squeeze a chip to nothing: they collapsed
		                      // to zero width once, which is why nobody could see them.
		                      flex: "none",
		                      background: "color-mix(in srgb, currentColor 9%, transparent)",
		                      border: "1px solid color-mix(in srgb, currentColor 15%, transparent)",
		                      borderRadius: 999,
		                      padding: "1px 4px 1px 8px",
		                      fontSize: 12
		                    },
		                    children: [
		                      "#",
		                      value,
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                        "button",
		                        {
		                          type: "button",
		                          title: t("detail.removeTag", { tag: value }),
		                          style: { ...actionStyle, padding: "2px 6px", gap: 2 },
		                          onClick: () => void onUpdate({ tags: detail.tags.filter((tag) => tag !== value) }),
		                          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(X, { size: 11 })
		                        }
		                      )
		                    ]
		                  },
		                  value
		                ))
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "input",
		              {
		                value: tags,
		                disabled: busy,
		                onChange: (event) => setTags(event.target.value),
		                "aria-label": t("app.tag"),
		                placeholder: t("detail.tagsPlaceholder"),
		                style: { ...paneRowStyle, ...inputStyle, width: "100%", boxSizing: "border-box" }
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { ...paneRowStyle, display: "flex", gap: 6 }, children: [
		              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                "button",
		                {
		                  type: "button",
		                  style: { ...primaryStyle, flex: 1, justifyContent: "center", whiteSpace: "nowrap" },
		                  disabled: busy,
		                  onClick: () => void onUpdate({
		                    title: title.trim(),
		                    note,
		                    tags: tags.split(",").map((value) => value.trim()).filter((value) => value.length > 0)
		                  }),
		                  children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Check, { size: 14 }),
		                    t("detail.save")
		                  ]
		                }
		              ),
		              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                "button",
		                {
		                  type: "button",
		                  style: { ...actionStyle, flex: 1, justifyContent: "center", whiteSpace: "nowrap" },
		                  disabled: busy || inBin,
		                  onClick: () => void onUpdate({ watchLater: detail.watchLater !== true }),
		                  children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Bookmark, { size: 14 }),
		                    detail.watchLater === true ? t("detail.unwatch") : t("detail.watch")
		                  ]
		                }
		              ),
		              inBin ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                "button",
		                {
		                  type: "button",
		                  style: { ...actionStyle, flex: 1, justifyContent: "center", whiteSpace: "nowrap" },
		                  disabled: busy,
		                  onClick: () => void onRestore(),
		                  children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RotateCcw, { size: 14 }),
		                    " ",
		                    t("detail.restore")
		                  ]
		                }
		              ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		                "button",
		                {
		                  type: "button",
		                  style: { ...dangerStyle, flex: 1, justifyContent: "center", whiteSpace: "nowrap" },
		                  disabled: busy,
		                  onClick: () => void onDelete(),
		                  children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Trash, { size: 14 }),
		                    " ",
		                    t("detail.delete")
		                  ]
		                }
		              )
		            ] })
		          ]
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		        "div",
		        {
		          style: {
		            position: "absolute",
		            left: 12,
		            right: 12,
		            bottom: 16,
		            fontSize: 12,
		            opacity: 0.6,
		            overflowWrap: "anywhere"
		          },
		          children: [
		            t("app.store"),
		            " ",
		            new Date(detail.createdAt).toLocaleString(),
		            detail.updatedAt === detail.createdAt ? "" : t("detail.updated", { when: new Date(detail.updatedAt).toLocaleString() })
		          ]
		        }
		      )
		    ] })
		  );
		}
		function describe(summary) {
		  const parts = [];
		  if (summary.stored > 0) parts.push(t("notice.saved", { count: summary.stored }));
		  const repeats = summary.merged - summary.restored;
		  if (repeats > 0) parts.push(t("notice.merged", { count: repeats }));
		  if (summary.restored > 0) parts.push(t("notice.restored", { count: summary.restored }));
		  return parts.join("\uFF0C");
		}
		function isRpcResult(value) {
		  return typeof value === "object" && value !== null && "ok" in value;
		}
		function formatBytes(bytes) {
		  if (bytes < 1024) return `${bytes} B`;
		  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
		}
		function attachmentCaption(attachment) {
		  const pixels = attachment.width === void 0 || attachment.height === void 0 ? "" : ` \xB7 ${String(attachment.width)}\xD7${String(attachment.height)}`;
		  return `${attachment.filename ?? attachment.mime}${pixels} \xB7 ${formatBytes(attachment.bytes)}`;
		}
		function attachmentUrl(id) {
		  return `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(id)}`;
		}
		async function toBase64(file) {
		  const bytes = new Uint8Array(await file.arrayBuffer());
		  let binary = "";
		  const chunk = 32768;
		  for (let offset = 0; offset < bytes.length; offset += chunk) {
		    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
		  }
		  return btoa(binary);
		}
		/*! Bundled license information:
		
		lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs:
		lucide-react/dist/esm/shared/src/utils/toLucideIconData.mjs:
		lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs:
		lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs:
		lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs:
		lucide-react/dist/esm/shared/src/build/defaultAttributes.mjs:
		lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs:
		lucide-react/dist/esm/shared/src/build/buildLucideIconForReact.mjs:
		lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs:
		lucide-react/dist/esm/context.mjs:
		lucide-react/dist/esm/Icon.mjs:
		lucide-react/dist/esm/createLucideIcon.mjs:
		lucide-react/dist/esm/icons/bookmark.mjs:
		lucide-react/dist/esm/icons/check.mjs:
		lucide-react/dist/esm/icons/chevron-down.mjs:
		lucide-react/dist/esm/icons/chevron-left.mjs:
		lucide-react/dist/esm/icons/chevron-right.mjs:
		lucide-react/dist/esm/icons/circle.mjs:
		lucide-react/dist/esm/icons/external-link.mjs:
		lucide-react/dist/esm/icons/file-text.mjs:
		lucide-react/dist/esm/icons/film.mjs:
		lucide-react/dist/esm/icons/id-card.mjs:
		lucide-react/dist/esm/icons/image.mjs:
		lucide-react/dist/esm/icons/inbox.mjs:
		lucide-react/dist/esm/icons/key-round.mjs:
		lucide-react/dist/esm/icons/layers.mjs:
		lucide-react/dist/esm/icons/layout-grid.mjs:
		lucide-react/dist/esm/icons/lightbulb.mjs:
		lucide-react/dist/esm/icons/play.mjs:
		lucide-react/dist/esm/icons/refresh-cw.mjs:
		lucide-react/dist/esm/icons/rotate-ccw.mjs:
		lucide-react/dist/esm/icons/settings-2.mjs:
		lucide-react/dist/esm/icons/tag.mjs:
		lucide-react/dist/esm/icons/trash.mjs:
		lucide-react/dist/esm/icons/x.mjs:
		lucide-react/dist/esm/lucide-react.mjs:
		  (**
		   * @license lucide-react v1.47.0 - ISC
		   *
		   * This source code is licensed under the ISC license.
		   * See the LICENSE file in the root directory of this source tree.
		   *)
		*/
		return module.exports;
	},
});
