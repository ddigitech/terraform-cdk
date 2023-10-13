// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import {
  Testing,
  TerraformStack,
  TerraformElement,
  Fn,
  TerraformIterator,
} from "../lib";
import { TestProvider, TestResource, OtherTestResource } from "./helper";
import { TestDataSource } from "./helper/data-source";
import { TerraformOutput } from "../lib/terraform-output";
import { Construct } from "constructs";

test("minimal configuration", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "test", {
    name: "foo",
  });
  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("with provider alias", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");

  new TestProvider(stack, "provider", {
    accessKey: "1",
  });

  const provider = new TestProvider(stack, "aliased-provider", {
    alias: "foo",
    accessKey: "123",
  });

  new TestResource(stack, "test", {
    name: "bar",
    provider,
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("provider setter", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");

  const provider = new TestProvider(stack, "provider", {
    accessKey: "1",
  });

  const resource = new TestResource(stack, "test", {
    name: "bar",
  });

  resource.provider = provider;

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("resource fqn", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");

  const resource = new TestResource(stack, "test", {
    name: "bar",
  });

  new TerraformOutput(stack, "result", {
    value: resource.fqn,
  });

  expect(JSON.parse(Testing.synth(stack) as any).output.result.value).toEqual(
    "${test_resource.test}"
  );
});

test("fqn is stable", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");

  const elementWithFQN = new TerraformElement(stack, "test", "valid_type");
  const fqn = elementWithFQN.fqn;
  expect(elementWithFQN.fqn).toBe(fqn);

  // May not override logical id after fqn has been requested
  expect(() => elementWithFQN.overrideLogicalId("new-id")).toThrow();

  const elementWithoutFQN = new TerraformElement(stack, "test2");
  // May not request fqn on element without element type
  expect(() => elementWithoutFQN.fqn).toThrow();
});

test("serialize list interpolation", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "tests");
  new TestProvider(stack, "provider", {});
  new TestProvider(stack, "other_provider", {
    type: "other",
  });

  const resource = new TestResource(stack, "test", {
    name: "bar",
  });

  const otherResource = new OtherTestResource(stack, "othertest", {});
  resource.names = otherResource.names;

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("with complex computed list", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "tests");
  new TestProvider(stack, "provider", {});
  new TestProvider(stack, "other_provider", {
    type: "other",
  });

  const otherResource = new OtherTestResource(stack, "othertest", {});

  new TestResource(stack, "test", {
    name: otherResource.complexComputedList.get(0).id,
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("do not change capitalization of tags", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "tests");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "test", {
    name: "bar",
    tags: {
      Tag: "isWorking",
    },
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("do not change capitalization of arbritary nested types", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "tests");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "test", {
    name: "bar",
    nestedType: {
      Tag: "isDowncased",
    },
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("dependent resource", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const dataSource = new TestDataSource(stack, "data_source", {
    name: "foo",
  });

  new TestResource(stack, "resource", {
    name: "foo",
    dependsOn: [dataSource],
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("numeric attributes", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const foo = new TestResource(stack, "resource", {
    name: "foo",
  });

  new TerraformOutput(stack, "combined-string-number", {
    value: `${foo.stringValue} / 23.324 / ${foo.numericValue} / 42`,
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("tokens as ids", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const foo = new TestResource(stack, "resource", {
    name: "foo",
  });

  expect(() => {
    new TestResource(stack, `resource-${foo.stringValue}`, {
      name: "foo",
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"You cannot use a Token (e.g. a reference to an attribute) as the id of a construct"`
  );
});

test("number[] attributes", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const foo = new TestResource(stack, "resource", {
    name: "foo",
  });

  new TerraformOutput(stack, "number-list", {
    value: foo.numberList,
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("using the same reference in two contexts", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const foo = new TestResource(stack, "resource", {
    name: "foo",
  });
  const reference = foo.stringValue;

  new TestResource(stack, "plain-function", {
    name: `plain:${reference}|inFunction:${Fn.lower(reference)}`,
  });

  new TestResource(stack, "function-plain", {
    name: `inFunction:${Fn.lower(reference)}|plain:${reference}`,
  });

  new TestResource(stack, "join", {
    name: `first:${Fn.join(",", [
      reference,
      `this is the ref: ${reference}`,
    ])}|second:${Fn.join(",", [`this is the ref: ${reference}`, reference])}`,
  });

  const q = JSON.parse(Testing.synth(stack)).resource.test_resource;

  expect(q["plain-function"].name).toBe(
    "plain:${test_resource.resource.string_value}|inFunction:${lower(test_resource.resource.string_value)}"
  );
  expect(q["function-plain"].name).toBe(
    "inFunction:${lower(test_resource.resource.string_value)}|plain:${test_resource.resource.string_value}"
  );
  expect(q["join"].name).toBe(
    `first:\${join(",", [test_resource.resource.string_value, "this is the ref: \${test_resource.resource.string_value}"])}|second:\${join(",", ["this is the ref: \${test_resource.resource.string_value}", test_resource.resource.string_value])}`
  );
});

it("supports file provisioner", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "content", {
    name: "foo",
    provisioners: [
      { type: "file", destination: "hello.txt", content: "my-content" },
    ],
  });
  new TestResource(stack, "source", {
    name: "bar",
    provisioners: [
      { type: "file", destination: "world.txt", source: "my.txt" },
    ],
  });
  expect(Testing.synth(stack)).toMatchSnapshot();
});

it("supports local-exec provisioner", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "simple", {
    name: "foo",
    provisioners: [{ type: "local-exec", command: "echo 'hello' > world.txt" }],
  });

  new TestResource(stack, "advanced", {
    name: "foo",
    provisioners: [
      {
        type: "local-exec",
        command: 'echo "hello $person" > greeting.txt',
        workingDir: "/tmp",
        environment: {
          person: "daniel",
        },
        interpreter: ["/bin/bash", "-c"],
      },
    ],
  });
  expect(Testing.synth(stack)).toMatchSnapshot();
});

it("maintains the same order of provisioner", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "simple", {
    name: "foo",
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  });

  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("includes import block when import is present", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "test", {
    name: "foo",
  }).importFrom("testId");
  expect(Testing.synth(stack)).toMatchSnapshot();
});

test("includes import block when import is present, provider given", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  const provider = new TestProvider(stack, "provider", {
    alias: "foo",
  });
  new TestResource(stack, "test", {
    name: "foo",
  }).importFrom("testId", provider);
  expect(Testing.synth(stack)).toMatchSnapshot();
});

it("moves resource to greater nesting in contained construct", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const construct = new Construct(stack, "construct");
  const nestedContruct = new Construct(construct, "nested-construct");

  new TestResource(nestedContruct, "simple", {
    name: "foo",
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  }).addResourceTag("test");

  new TestResource(stack, "simple", {
    name: "foo",
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  }).moveTo("test");

  expect(Testing.synth(stack)).toMatchSnapshot();
});

it("moves resource to a lesser nesting from contained construct", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "simple", {
    name: "foo",
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  }).addResourceTag("test");
  const construct = new Construct(stack, "construct");
  const nestedContruct = new Construct(construct, "nested-construct");

  new TestResource(nestedContruct, "simple", {
    name: "foo",
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  }).moveTo("test");

  expect(Testing.synth(stack)).toMatchSnapshot();
});

it("moves resource to be in composition with foreach using list iterator", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const iterator = TerraformIterator.fromList(["foo-one", "foo-two"]);

  new TestResource(stack, "simple-foreach", {
    forEach: iterator,
    name: iterator.value,
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  }).addResourceTag("test");

  new TestResource(stack, "simple", {
    name: "foo-one",
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  }).moveTo("test", "foo-one");

  expect(Testing.synth(stack)).toMatchSnapshot();
});

it("moves resource to be in composition with foreach using complex iterator", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  const complexIterator = TerraformIterator.fromMap({
    "simple-foreach-one": {
      name: "foo-one",
      tags: {
        tag1: "tag1",
      },
    },
    "simple-foreach-two": {
      name: "foo-two",
      tags: {
        tag2: "tag2",
      },
    },
  });

  new TestResource(stack, "simple-foreach", {
    forEach: complexIterator,
    name: complexIterator.getString("name"),
    tags: complexIterator.getMap("tags"),
  }).addResourceTag("test");

  new TestResource(stack, "simple", {
    name: "foo-one",
    tags: {
      tag1: "tag1",
    },
  }).moveTo("test", "simple-foreach-one");

  expect(Testing.synth(stack)).toMatchSnapshot();
});

it("moves resource to resource with rename", () => {
  const app = Testing.app();
  const stack = new TerraformStack(app, "test");
  new TestProvider(stack, "provider", {});

  new TestResource(stack, "simple", {
    name: "foo",
    provisioners: [
      { type: "local-exec", command: "echo 'hello' > world.txt" },
      { type: "local-exec", command: "echo 'hello' > world1.txt" },
      { type: "local-exec", command: "echo 'hello' > world2.txt" },
    ],
  }).renameResourceId("simple-rename");

  expect(Testing.synth(stack)).toMatchSnapshot();
});
