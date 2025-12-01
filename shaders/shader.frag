#version 450

layout(location = 0) in vec3 f_position;
layout(location = 1) in vec3 f_normal;
layout(location = 2) in vec2 f_uv;
layout(location = 0) out vec4 out_color;

layout(set = 0, binding = 0) uniform SceneUniforms {
    mat4 view_projection;
    vec3 camera_position;
    uint num_spot_lights;
    uint _pad_align0;
    uint _pad_align1;
    uint _pad_align2;
    vec3 dir_direction;
    float dir_intensity;
    vec3 dir_ambient;
    float _pad_dir0;
    vec3 dir_diffuse;
    float _pad_dir1;
    vec3 dir_specular;
    float _pad_dir2;
    vec3 ambient_color;
} scene;

layout(set = 1, binding = 0) uniform ModelUniforms {
    mat4 model;
    vec3 albedo_color;
    float shininess;
    vec3 specular_color;
    float _pad0;
} material;

layout(set = 1, binding = 1) uniform sampler2D u_texture;

struct SSBO_LightColors {
    vec3 ambient; float _pad0;
    vec3 diffuse; float _pad1;
    vec3 specular; float _pad2;
};

struct SSBO_SpotLight {
    vec3 position; float _pad0;
    SSBO_LightColors colors;
    float linear;
    float quadratic;
    float _pad1;
    float _pad2;
    vec3 direction;
    float cut_off;
    float outer_cut_off;
    float _pad3;
    float _pad4;
};

layout(set = 0, binding = 1) readonly buffer SpotLights {
    SSBO_SpotLight spots[];
} spotLights;

vec3 calc_ambient_light(vec3 albedo) {
    return scene.ambient_color * albedo;
}

vec3 calc_dir_light(vec3 N, vec3 V, vec3 albedo, vec3 specular_col, float shininess) {
    vec3 L = normalize(-scene.dir_direction);
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = scene.dir_diffuse * NdotL;
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float spec_intensity = (NdotL > 0.0) ? pow(NdotH, shininess) : 0.0;
    vec3 specular = scene.dir_specular * spec_intensity;
    return (albedo * diffuse + specular_col * specular) * scene.dir_intensity;
}

vec3 calc_spot_light(SSBO_SpotLight light, vec3 N, vec3 V, vec3 P, vec3 albedo, vec3 specular_col, float shininess) {
    vec3 L = light.position - P;
    float dist = length(L);
    L = normalize(L);
    vec3 spotDir = normalize(-light.direction);
    float theta = dot(L, spotDir);
    float epsilon = light.cut_off - light.outer_cut_off;
    float intensity = clamp((theta - light.outer_cut_off) / max(epsilon, 1e-6), 0.0, 1.0);
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = light.colors.diffuse * NdotL;
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    vec3 specular = light.colors.specular * pow(NdotH, shininess);
    float attenuation = 1.0 / (1.0 + light.linear * dist + light.quadratic * dist * dist);
    vec3 ambient = light.colors.ambient;
    return (ambient + albedo * diffuse + specular_col * specular) * attenuation * intensity;
}

void main() {
    vec3 N = normalize(f_normal);
    vec3 P = f_position;
    vec3 V = normalize(scene.camera_position - P);
    vec3 tex_color = texture(u_texture, f_uv).rgb;
    vec3 albedo = tex_color;
    vec3 specular_col = material.specular_color;
    float shininess = material.shininess;

    vec3 color = vec3(0.0);
    color += calc_ambient_light(albedo);
    color += calc_dir_light(N, V, albedo, specular_col, shininess);
    for (uint i = 0u; i < scene.num_spot_lights; ++i) {
        color += calc_spot_light(spotLights.spots[i], N, V, P, albedo, specular_col, shininess);
    }

    out_color = vec4(color, 1.0);
}