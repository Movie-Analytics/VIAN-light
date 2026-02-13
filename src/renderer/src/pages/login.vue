<template>
  <v-container max-width="600">
    <div class="my-10">
      <h1 class="mb-3 text-center text-h1">VIAN</h1>

      <p>VIAN is an open video annotation application. Some of it features are:</p>

      <ul class="ms-5 mt-1">
        <li>automatic shotboundary detection</li>

        <li>import and export to ELAN</li>

        <li>screenshot generation</li>

        <li>works in the browser or via Electron as a dekstop application</li>
      </ul>
    </div>

    <v-card>
      <v-tabs v-model="tab" show-arrows>
        <v-tab value="login">Login</v-tab>

        <v-tab value="signup">Signup</v-tab>
      </v-tabs>

      <v-card-text>
        <v-tabs-window v-model="tab">
          <v-tabs-window-item value="login">
            <v-form>
              <v-text-field
                v-model="email"
                label="E-Mail"
                :rules="mailRule"
                required
              ></v-text-field>

              <v-text-field
                v-model="password"
                label="Password"
                type="password"
                :rules="lengthRule"
                required
              ></v-text-field>
            </v-form>

            <v-btn block class="ma-1" @click="login">Login</v-btn>
          </v-tabs-window-item>

          <v-tabs-window-item value="signup">
            <v-form>
              <v-text-field
                v-model="email"
                label="E-Mail"
                :rules="mailRule"
                required
              ></v-text-field>

              <v-text-field
                v-model="password"
                label="Password"
                type="password"
                :rules="lengthRule"
                required
              ></v-text-field>
            </v-form>

            <v-btn block class="ma-1" @click="signup">Sign up</v-btn>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import { mapStores } from 'pinia'
import { useTempStore } from '@renderer/stores/temp'

export default {
  name: 'Login',

  data: () => ({
    email: '',
    lengthRule: [(v) => v && v.length > 3],
    mailRule: [(v) => v && v.length > 3 && v.indexOf('@') >= 0],
    password: '',
    tab: null
  }),

  computed: {
    ...mapStores(useTempStore)
  },

  methods: {
    async login() {
      if (await this.tempStore.login(this.email, this.password)) this.$router.push('/')
    },

    async signup() {
      if (await this.tempStore.signup(this.email, this.password)) this.$router.push('/')
    }
  }
}
</script>
