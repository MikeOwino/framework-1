<template>
  <div>
    <ClientScript ref="clientScript" class="client-only-script" foo="bar" />
    <ClientSetupScript
      ref="clientSetupScript"
      class="client-only-script-setup"
      foo="hello"
    >
      <template #test>
        <div class="slot-test">
          Hello
        </div>
      </template>
    </ClientSetupScript>
    <ClientOnly>
      Should not be server rendered.
      <template #fallback>
        <div>Fallback</div>
      </template>
    </ClientOnly>
    <!-- ensure multi root node components are correctly rendered (Fragment) -->
    <ClientMultiRootNode class="multi-root-node" />
    <ClientMultiRootNodeScript class="multi-root-node-script" />

    <!-- ensure components with a single single child are correctly rendered -->
    <ClientStringChildStateful ref="stringStatefulComp" class="string-stateful" />
    <ClientStringChildStatefulScript
      ref="stringStatefulScriptComp"
      class="string-stateful-script"
    />
    <ClientNoState class="no-state" />
    <!-- ensure directives are correctly passed -->
    <ClientStringChildStateful v-show="show" class="string-stateful-should-be-hidden" />
    <ClientSetupScript v-show="show" class="client-script-should-be-hidden" foo="bar" />
    <ClientStringChildStatefulScript
      v-show="show"
      class="string-stateful-script-should-be-hidden"
    />
    <ClientNoState v-show="show" class="no-state-hidden" />

    <button class="test-ref-1" @click="stringStatefulComp.add">
      increment count
    </button>
    <button class="test-ref-2" @click="stringStatefulScriptComp.add">
      increment count
    </button>
    <button class="test-ref-3" @click="clientScript.add">
      increment count
    </button>
    <button class="test-ref-4" @click="clientSetupScript.add">
      increment count
    </button>

    <button id="show-all" @click="show = true">
      Show all
    </button>
  </div>
</template>

<script setup lang="ts">
const stringStatefulComp = ref(null)
const stringStatefulScriptComp = ref(null)
const clientScript = ref(null)
const clientSetupScript = ref(null)

const show = ref(false)
</script>
